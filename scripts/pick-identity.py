#!/usr/bin/env python3
"""Keeps one identity from `openssl pkcs12 -nodes` output, because `security export` gives all of them.

Usage: pick-identity.py ALL_PEM NAME CERT_OUT KEY_OUT
"""
import re
import sys

all_pem, name, cert_out, key_out = sys.argv[1:5]
bags = re.findall(r'Bag Attributes(.*?)(-----BEGIN ([A-Z ]+)-----.*?-----END \3-----)', open(all_pem).read(), re.S)
certs = [(attrs, pem) for attrs, pem, kind in bags if kind == 'CERTIFICATE']
keys = [(attrs, pem) for attrs, pem, kind in bags if 'PRIVATE KEY' in kind]


def key_id(attrs):
    found = re.search(r'localKeyID:\s*([0-9A-Fa-f ]+)', attrs)
    return found.group(1).strip() if found else None


matches = [c for c in certs if name in c[0]]
if len(matches) != 1:
    sys.exit(f'Expected one certificate named {name}, found {len(matches)}')
pair = [k for k in keys if key_id(k[0]) == key_id(matches[0][0])]
if len(pair) != 1:
    sys.exit(f'Expected one private key for {name}, found {len(pair)}')
open(cert_out, 'w').write(matches[0][1] + '\n')
open(key_out, 'w').write(pair[0][1] + '\n')
print(f'Keychain held {len(certs)} certificates. Kept only: {name}')
