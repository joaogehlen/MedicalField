package br.univates.medicalfield.identity.security;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/** Leitura das chaves RSA em PEM (PKCS#8 para a privada, X.509 para a pública). */
final class PemKeys {

    private PemKeys() {}

    static RSAPrivateKey privateKey(String path) {
        try {
            byte[] der = decode(path, "PRIVATE KEY");
            return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (GeneralSecurityException | IOException e) {
            throw new IllegalStateException("Não foi possível ler a chave privada do JWT em " + path, e);
        }
    }

    static RSAPublicKey publicKey(String path) {
        try {
            byte[] der = decode(path, "PUBLIC KEY");
            return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
        } catch (GeneralSecurityException | IOException e) {
            throw new IllegalStateException("Não foi possível ler a chave pública do JWT em " + path, e);
        }
    }

    private static byte[] decode(String path, String type) throws IOException {
        String pem = Files.readString(Path.of(path));
        String base64 = pem
                .replace("-----BEGIN " + type + "-----", "")
                .replace("-----END " + type + "-----", "")
                .replaceAll("\\s", "");
        return Base64.getDecoder().decode(base64);
    }
}
