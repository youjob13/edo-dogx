# EDO: запуск в Docker

## 1. Установите инструменты

- Git
- Docker с Docker Compose v2

Проверьте установку:

```bash
git --version
docker --version
docker compose version
```

## 2. Склонируйте проект

```bash
git clone <repository-url> edo
cd edo
```

## 3. Создайте `.env`

```bash
cp .env.example .env
```

## 4. Запустите проект

```bash
docker compose up -d
```

## 5. Проверьте запуск

```bash
docker compose ps
```

Откройте приложение:

```text
http://localhost:4000
```

Основные адреса:

| Сервис | URL |
| --- | --- |
| Frontend | http://localhost:4000 |
| API Gateway | http://localhost:3000 |
| Keycloak | http://localhost:8080 |
| MinIO Console | http://localhost:9001 |

## 6. Остановите проект

```bash
docker compose down
```
