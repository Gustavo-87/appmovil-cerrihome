#!/usr/bin/env python3
"""Run on the owner's Mac. Never prints key material or passwords."""
import base64
import getpass
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile

REPO = 'Gustavo-87/appmovil-cerrihome'
SERVICE = 'com.cerritoshome.android.permanent.v1.recovery'
ACCOUNT = getpass.getuser()
DIRECTORY = Path.home() / '.config/cerritos-home/android-signing-v1'
BACKUP = DIRECTORY / 'permanent-signing-backup.enc'
OPENSSL = next((str(path) for path in [Path('/opt/homebrew/opt/openssl@3/bin/openssl'),
                                      Path('/usr/local/opt/openssl@3/bin/openssl')] if path.exists()), 'openssl')


def run(args, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        # Some programs echo their input on error: do not forward output.
        raise RuntimeError('Falló ' + Path(str(args[0])).name + '; no se muestran detalles que puedan contener credenciales.')
    return result.stdout


def crypt(payload, password, decrypt=False):
    header = b'CERRITOS-SIGNING-V1\x00'
    if decrypt:
        if not payload.startswith(header) or len(payload) < len(header) + 64:
            raise RuntimeError('Formato de respaldo incorrecto.')
        salt = payload[len(header):len(header) + 16]
        authentication_key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000)
        if not hmac.compare_digest(hmac.new(authentication_key, payload[:-32], hashlib.sha256).digest(), payload[-32:]):
            raise RuntimeError('Contraseña incorrecta o respaldo modificado.')
        payload = payload[len(header) + 16:-32]
    read_fd, write_fd = os.pipe()
    try:
        os.write(write_fd, password.encode() + b'\n')
        os.close(write_fd)
        write_fd = None
        args = [OPENSSL, 'enc', '-aes-256-cbc', '-pbkdf2', '-iter', '600000', '-md', 'sha256', '-pass', f'fd:{read_fd}']
        if decrypt:
            args.append('-d')
        result = run(args, input=payload, pass_fds=(read_fd,))
        if decrypt:
            return result
        salt = secrets.token_bytes(16)
        authentication_key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000)
        envelope = header + salt + result
        return envelope + hmac.new(authentication_key, envelope, hashlib.sha256).digest()
    finally:
        os.close(read_fd)
        if write_fd is not None:
            os.close(write_fd)


def fingerprint(keystore, password, alias, keytool):
    env = dict(os.environ, CERRITOS_SETUP_PASSWORD=password)
    pem = run([keytool, '-exportcert', '-rfc', '-keystore', str(keystore), '-alias', alias,
               '-storepass:env', 'CERRITOS_SETUP_PASSWORD'], env=env).decode()
    encoded = re.search(r'-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----', pem, re.S)[1]
    return hashlib.sha256(base64.b64decode(encoded)).hexdigest()


def main():
    if sys.platform != 'darwin':
        raise RuntimeError('Ejecuta este script en tu Mac; utiliza el Llavero de macOS.')
    os.umask(0o077)
    # Test actual permission before generating anything. Does not print the public key.
    run(['gh', 'api', f'repos/{REPO}/actions/secrets/public-key'])
    probe_password = secrets.token_urlsafe(32)
    if crypt(crypt(b'backup-readiness', probe_password), probe_password, decrypt=True) != b'backup-readiness':
        raise RuntimeError('OpenSSL no permite verificar el respaldo cifrado.')
    keytool = shutil.which('keytool')
    studio = Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool')
    if studio.exists():
        keytool = str(studio)
    if not keytool:
        raise RuntimeError('Instala JDK 21 o Android Studio antes de continuar.')
    DIRECTORY.mkdir(parents=True, exist_ok=True, mode=0o700)
    private = DIRECTORY / 'permanent.p12'
    if BACKUP.exists():
        recovery = run(['security', 'find-generic-password', '-a', ACCOUNT, '-s', SERVICE, '-w']).decode().strip()
        payload = json.loads(crypt(BACKUP.read_bytes(), recovery, decrypt=True))
        if not private.exists():
            private.write_bytes(base64.b64decode(payload['keystore']))
        if base64.b64encode(private.read_bytes()).decode() != payload['keystore']:
            raise RuntimeError('La clave local y el respaldo no coinciden; no se sobrescribe nada.')
    else:
        if private.exists():
            raise RuntimeError('Hay una clave sin respaldo confirmado. Se conserva; requiere recuperación manual.')
        recovery = secrets.token_urlsafe(48)
        command = 'add-generic-password -U -a ' + shlex.quote(ACCOUNT) + ' -s ' + shlex.quote(SERVICE) + ' -w ' + shlex.quote(recovery) + '\n'
        run(['security', '-i'], input=command.encode())
        confirmed = run(['security', 'find-generic-password', '-a', ACCOUNT, '-s', SERVICE, '-w']).decode().strip()
        if not secrets.compare_digest(recovery, confirmed):
            raise RuntimeError('No se pudo verificar el secreto de recuperación en el Llavero.')
        password = secrets.token_urlsafe(48)
        alias = 'cerritos-home-permanent-v1'
        run([keytool, '-genkeypair', '-keystore', str(private), '-storetype', 'PKCS12', '-alias', alias,
             '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', 'CN=Cerritos Home Android, O=Cerritos Home',
             '-storepass:env', 'CERRITOS_SETUP_PASSWORD', '-keypass:env', 'CERRITOS_SETUP_PASSWORD'],
            env=dict(os.environ, CERRITOS_SETUP_PASSWORD=password))
        payload = {'keystore': base64.b64encode(private.read_bytes()).decode(), 'store_password': password,
                   'key_password': password, 'alias': alias}
        BACKUP.write_bytes(crypt(json.dumps(payload).encode(), recovery))
    # Recover into a separate protected file and verify the recovered certificate.
    recovered = json.loads(crypt(BACKUP.read_bytes(), recovery, decrypt=True))
    if recovered != payload:
        raise RuntimeError('El ensayo de restauración del respaldo falló.')
    certificate = fingerprint(private, payload['store_password'], payload['alias'], keytool)
    private.chmod(0o600)
    BACKUP.chmod(0o600)
    with tempfile.TemporaryDirectory(dir=DIRECTORY) as temporary:
        restored = Path(temporary) / 'restored.p12'
        restored.write_bytes(base64.b64decode(recovered['keystore']))
        if fingerprint(restored, recovered['store_password'], recovered['alias'], keytool) != certificate:
            raise RuntimeError('El certificado recuperado no coincide.')
    # An independent encrypted copy; recovery password remains in macOS Keychain.
    backup_copy = Path.home() / 'Documents/CerritosHome-firma/permanent-signing-backup.enc'
    backup_copy.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if backup_copy.exists() and backup_copy.read_bytes() != BACKUP.read_bytes():
        raise RuntimeError('Ya existe otro respaldo en Documents; no se sobrescribe.')
    backup_copy.write_bytes(BACKUP.read_bytes())
    backup_copy.chmod(0o600)
    secret_values = {
        'CERRITOS_ANDROID_KEYSTORE_BASE64': payload['keystore'],
        'CERRITOS_ANDROID_STORE_PASSWORD': payload['store_password'],
        'CERRITOS_ANDROID_KEY_PASSWORD': payload['key_password'],
        'CERRITOS_ANDROID_KEY_ALIAS': payload['alias'],
        'CERRITOS_ANDROID_CERT_SHA256': certificate,
        'CERRITOS_ANDROID_BACKUP_VERIFIED': hashlib.sha256(BACKUP.read_bytes()).hexdigest(),
    }
    for name, value in secret_values.items():
        run(['gh', 'secret', 'set', name, '--repo', REPO], input=value.encode())
    names = {row['name'] for row in json.loads(run(['gh', 'secret', 'list', '--repo', REPO, '--json', 'name']))}
    if not set(secret_values).issubset(names):
        raise RuntimeError('No se confirmó el registro de todos los secretos.')
    print('Firma permanente respaldada, restauración verificada y seis secretos registrados.')
    print('Respaldo cifrado: ' + str(backup_copy))
    print('Recuperación: Llavero de macOS, elemento ' + SERVICE)
    print('Copia el respaldo cifrado a otro dispositivo y conserva la contraseña de recuperación en tu gestor de contraseñas.')
    run(['gh', 'workflow', 'run', 'android-new-phone.yml', '--repo', REPO, '--ref', 'main',
         '-f', 'source_ref=main', '-f', 'publish=true'])
    print('Solicitada la compilación y publicación de la APK para teléfono nuevo.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
