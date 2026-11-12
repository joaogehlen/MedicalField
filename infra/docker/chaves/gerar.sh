#!/bin/sh
# Gera o par de chaves RSA do JWT na primeira subida (fica no volume "chaves").
# O identity-service assina com a privada; clinical e document validam com a pública.
set -e
cd /chaves
if [ ! -f jwt-private.pem ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem 2>/dev/null
  openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem 2>/dev/null
  echo "Chaves do JWT criadas."
else
  echo "Chaves do JWT já existem."
fi
chown 1000 jwt-private.pem jwt-public.pem
chmod 400 jwt-private.pem
chmod 444 jwt-public.pem
