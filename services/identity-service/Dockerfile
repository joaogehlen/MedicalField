# identity-service — Java 21 · Spring Boot (autenticação e logs do aparelho)

# 1) Compila o .jar com Maven
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# 2) Imagem final só com o Java e o .jar
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /src/target/identity-service.jar app.jar
ENV SERVER_ADDRESS=0.0.0.0 \
    SERVER_PORT=8081
EXPOSE 8081
USER 1000
CMD ["java", "-Xmx384m", "-jar", "app.jar"]
