# Чек-лист развертывания: Система оркестрации задач

## Предварительные требования

### Системные требования
- [ ] PostgreSQL 16+ с расширениями `uuid-ossp` и `pgcrypto`
- [ ] Redis 7+ для сессий
- [ ] Elasticsearch 8.14+ для поиска
- [ ] MinIO для хранения экспортов документов
- [ ] Keycloak 24+ для аутентификации
- [ ] Node.js 24.15+ и pnpm 9+ для сборки

### Переменные окружения
- [ ] `.env` файл создан на основе `.env.example`
- [ ] `POSTGRES_PASSWORD` установлена
- [ ] `KEYCLOAK_ADMIN_PASSWORD` установлена
- [ ] `REDIS_PASSWORD` установлена
- [ ] `MINIO_ACCESS_KEY` и `MINIO_SECRET_KEY` установлены

## Этап 1: Сборка и тестирование

### Локальная разработка
```bash
# Установка зависимостей
pnpm install

# Сборка всех компонентов
pnpm build:all

# Лinting
pnpm lint:all

# Запуск тестов (если включены)
# pnpm test:all
```

### Docker сборка
```bash
# Сборка всех образов
docker compose build

# Валидация образов
docker images | grep edo
```

## Этап 2: Развертывание инфраструктуры

### Запуск инфраструктуры
```bash
# Запуск только инфраструктурных сервисов
docker compose up -d postgres redis elasticsearch minio keycloak

# Ожидание готовности
docker compose ps
```

### Проверка инфраструктуры
```bash
# PostgreSQL
docker compose exec postgres pg_isready -U edo_user -d edo

# Redis
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Elasticsearch
curl -f http://localhost:9200/_cluster/health

# MinIO
curl -f http://localhost:9000/minio/health/live

# Keycloak
curl -f http://localhost:8080/health/ready
```

## Этап 3: Развертывание микросервисов

### Запуск микросервисов
```bash
# Запуск микросервисов
docker compose up -d document-service signature-service search-notification-service

# Проверка логов
docker compose logs -f document-service
```

### Проверка микросервисов
```bash
# Document service health
grpc-health-probe -addr=localhost:50052

# Signature service health
grpc-health-probe -addr=localhost:50054

# Search-notification service health
grpc-health-probe -addr=localhost:50055
```

## Этап 4: Развертывание приложений

### Gateway
```bash
# Сборка и запуск gateway
docker compose up -d gateway

# Проверка gateway
curl -f http://localhost:3000/api/health

# Проверка API документации
curl -f http://localhost:3000/api/docs
```

### Frontend
```bash
# Сборка и запуск frontend
docker compose up -d frontend

# Проверка frontend
curl -f http://localhost:4000
```

## Этап 5: Функциональное тестирование

### API тестирование
```bash
# Проверка health endpoints
curl -f http://localhost:3000/api/health

# Тестирование аутентификации (нужен токен)
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/documents

# Тестирование новых task endpoints
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/boards
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/tasks/available-approvers
```

### UI тестирование
```bash
# Открыть браузер и проверить:
# - http://localhost:4000 (главная страница)
# - http://localhost:4000/dashboard/tasks (канбан-доска)
# - Создание новой задачи
# - Перемещение задач между колонками
# - Прикрепление документов
```

### Интеграционное тестирование
```bash
# Полный workflow тест:
# 1. Создать задачу с прикреплением
# 2. Переместить в "На проверке"
# 3. Одобрить задачу
# 4. Проверить уведомления
```

## Этап 6: Мониторинг и оптимизация

### Метрики для мониторинга
```sql
-- Производительность задач
SELECT
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_lifetime_seconds
FROM tasks
GROUP BY status;

-- Использование индексов
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename LIKE '%task%';
```

### Логи для проверки
```bash
# Gateway логи
docker compose logs -f gateway | grep -i task

# Document service логи
docker compose logs -f document-service | grep -i task

# Database логи
docker compose logs -f postgres | grep -i task
```

## Этап 7: Окончательная проверка

### Производственная готовность
- [ ] Все сервисы запущены и healthy
- [ ] API endpoints отвечают корректно
- [ ] UI загружается и работает
- [ ] Аутентификация работает
- [ ] База данных содержит корректные таблицы
- [ ] Миграции применены успешно

### Резервное копирование
- [ ] Backup скрипты настроены
- [ ] Тест восстановления выполнен
- [ ] Backup retention политика установлена

### Мониторинг
- [ ] Метрики собираются
- [ ] Алёрты настроены
- [ ] Dashboard для мониторинга создан

## Команды для обслуживания

### Остановка всех сервисов
```bash
docker compose down
```

### Очистка данных (для development)
```bash
docker compose down -v
docker system prune -f
```

### Просмотр логов
```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f gateway
```

### Перезапуск сервиса
```bash
docker compose restart gateway
```

### Масштабирование (если необходимо)
```bash
# Масштабирование gateway
docker compose up -d --scale gateway=3
```

## Устранение неисправностей

### Проблема: Сервис не запускается
```bash
# Проверить логи
docker compose logs <service-name>

# Проверить зависимости
docker compose ps

# Проверить переменные окружения
docker compose exec <service-name> env
```

### Проблема: API возвращает ошибки
```bash
# Проверить connectivity
curl -v http://localhost:3000/api/health

# Проверить database connection
docker compose exec gateway npx tsx -e "
import { TaskService } from './src/application/task.service.js';
console.log('DB connection OK');
"
```

### Проблема: UI не загружается
```bash
# Проверить frontend логи
docker compose logs frontend

# Проверить gateway availability
curl -f http://localhost:3000

# Проверить CORS настройки
curl -H "Origin: http://localhost:4000" http://localhost:3000/api/health
```

## Контакты поддержки

- **Техническая поддержка**: dev-support@company.com
- **Мониторинг**: monitoring@company.com
- **Инфраструктура**: infra@company.com

---

**Версия чек-листа**: 1.0
**Дата**: Май 2026</content>
<parameter name="filePath">c:\Users\danil\personal\edo\DEPLOYMENT_CHECKLIST.md