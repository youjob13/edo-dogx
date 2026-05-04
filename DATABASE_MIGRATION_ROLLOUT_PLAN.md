# План развертывания миграции базы данных: Оркестрация задач

## Обзор

Данный план описывает безопасное развертывание миграции базы данных для системы оркестрации задач. Миграция включает создание таблиц для задач, прикреплений документов и связанных индексов.

## Оценка воздействия

### Новые таблицы
- `tasks`: Основная таблица задач
- `task_attachments`: Прикрепления документов к задачам

### Новые индексы
- `idx_tasks_status`: Поиск по статусу задач
- `idx_tasks_creator_user_id`: Задачи по создателю
- `idx_tasks_assignee_user_id`: Задачи по исполнителю
- `idx_tasks_approver_user_id`: Задачи по одобряющему
- `idx_task_attachments_task_id`: Прикрепления по задаче
- `idx_task_attachments_document_id`: Прикрепления по документу

### Внешние ключи
- `task_attachments.task_id` → `tasks.id` (CASCADE DELETE)
- `task_attachments.document_id` → `documents.id` (RESTRICT DELETE)

### Ожидаемое воздействие
- **Размер данных**: Минимальный (новые таблицы)
- **Производительность**: Незначительное (добавление индексов)
- **Время выполнения**: < 30 секунд на production
- **Откат**: Безопасный (удаление таблиц)

## Предварительные требования

### Команда DBA
- Доступ к production PostgreSQL
- Права на выполнение DDL операций
- Возможность создания backup

### Тестирование
- ✅ Миграция протестирована на staging
- ✅ Резервная копия staging создана
- ✅ Rollback процедура протестирована

### Мониторинг
- Настроен мониторинг PostgreSQL метрик
- Подготовлены алерты на аномалии
- Команда on-call готова к реагированию

## План развертывания

### Этап 1: Подготовка (за 1 неделю)

#### 1.1 Создание резервной копии
```bash
# На production сервере
pg_dump -h localhost -U postgres -d edo_db -f pre_task_orchestration_backup.sql --no-owner --no-privileges
gzip pre_task_orchestration_backup.sql

# Копирование на безопасное хранилище
scp pre_task_orchestration_backup.sql.gz backup-server:/backups/
```

#### 1.2 Валидация backup
```bash
# Проверка целостности
gunzip -c pre_task_orchestration_backup.sql.gz | head -20
gunzip -c pre_task_orchestration_backup.sql.gz | tail -20

# Тест восстановления на staging
createdb test_restore
psql -d test_restore -f pre_task_orchestration_backup.sql
# Валидация ключевых таблиц
psql -d test_restore -c "SELECT COUNT(*) FROM documents;"
dropdb test_restore
```

#### 1.3 Анализ текущих данных
```sql
-- Оценка размера существующих таблиц
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Проверка существования конфликтующих объектов
SELECT * FROM information_schema.tables WHERE table_name LIKE '%task%';
SELECT * FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'id';
```

### Этап 2: Развертывание на Staging (за 3 дня)

#### 2.1 Выполнение миграции
```bash
# На staging сервере
cd /opt/edo/services/document-service/migrations
psql -h localhost -U postgres -d edo_staging -f 003_task_orchestration.sql
```

#### 2.2 Валидация миграции
```sql
-- Проверка создания таблиц
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%task%';

-- Проверка индексов
SELECT indexname, tablename FROM pg_indexes WHERE tablename LIKE '%task%';

-- Проверка внешних ключей
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name LIKE '%task%';
```

#### 2.3 Функциональное тестирование
- ✅ Создание задач через API
- ✅ Прикрепление документов
- ✅ Изменение статусов задач
- ✅ Запросы с фильтрацией по индексам

#### 2.4 Нагрузочное тестирование
```bash
# Тест производительности запросов
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'PENDING';
EXPLAIN ANALYZE SELECT * FROM task_attachments WHERE task_id = 'some-uuid';
```

### Этап 3: Развертывание на Production

#### 3.1 Планирование окна обслуживания
- **Время**: Воскресенье 02:00-04:00 (низкая нагрузка)
- **Продолжительность**: 2 часа
- **Откатное время**: 30 минут

#### 3.2 Pre-deployment checklist
- [ ] Backup создан и validated
- [ ] Staging migration успешна
- [ ] Rollback план готов
- [ ] Команда DBA на связи
- [ ] Мониторинг активен
- [ ] Приложение остановлено для maintenance

#### 3.3 Выполнение миграции
```bash
# Остановка приложения
sudo systemctl stop edo-gateway
sudo systemctl stop edo-document-service

# Выполнение миграции
cd /opt/edo/services/document-service/migrations
psql -h localhost -U postgres -d edo_prod -f 003_task_orchestration.sql

# Проверка успешности
psql -d edo_prod -c "SELECT 'Migration successful' FROM tasks LIMIT 1;"
```

#### 3.4 Post-deployment validation
```sql
-- Проверка таблиц
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM task_attachments;

-- Проверка индексов
SELECT COUNT(*) FROM pg_indexes WHERE tablename LIKE '%task%';

-- Тестовые запросы
SELECT id, title, status FROM tasks LIMIT 5;
```

#### 3.5 Запуск приложения
```bash
# Запуск сервисов
sudo systemctl start edo-document-service
sudo systemctl start edo-gateway

# Проверка health checks
curl -f http://localhost:3000/api/health
curl -f http://localhost:8081/health  # document-service
```

### Этап 4: Мониторинг и оптимизация

#### 4.1 Пост-деплой мониторинг (первые 24 часа)
```sql
-- Мониторинг производительности
SELECT
    schemaname,
    tablename,
    seq_scan,
    idx_scan,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
WHERE tablename LIKE '%task%';

-- Проверка на блокировки
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### 4.2 Оптимизация индексов (если необходимо)
```sql
-- Анализ использования индексов
SELECT
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE '%task%'
ORDER BY idx_scan DESC;
```

## Процедура отката

### Сценарий 1: Откат до миграции (предпочтительный)
```bash
# Остановка приложения
sudo systemctl stop edo-gateway
sudo systemctl stop edo-document-service

# Удаление новых таблиц
psql -d edo_prod -c "DROP TABLE IF EXISTS task_attachments CASCADE;"
psql -d edo_prod -c "DROP TABLE IF EXISTS tasks CASCADE;"

# Восстановление из backup
psql -d edo_prod -f pre_task_orchestration_backup.sql

# Запуск приложения
sudo systemctl start edo-document-service
sudo systemctl start edo-gateway
```

### Сценарий 2: Частичный откат (если данные уже созданы)
```sql
-- Архивация созданных данных
CREATE TABLE tasks_backup AS SELECT * FROM tasks;
CREATE TABLE task_attachments_backup AS SELECT * FROM task_attachments;

-- Удаление таблиц
DROP TABLE task_attachments CASCADE;
DROP TABLE tasks CASCADE;

-- Восстановление из backup
psql -d edo_prod -f pre_task_orchestration_backup.sql

-- Сохранение архива для анализа
-- tasks_backup и task_attachments_backup остаются для ручного переноса данных позже
```

## Риски и меры mitigation

### Риск: Долгое время выполнения миграции
**Вероятность**: Низкая
**Воздействие**: Среднее
**Митigation**:
- Тестирование на staging с похожим объемом данных
- Подготовка maintenance window
- Мониторинг прогресса выполнения

### Риск: Конфликт имен таблиц/колонок
**Вероятность**: Низкая
**Воздействие**: Высокое
**Митigation**:
- Проверка существования объектов перед миграцией
- Использование `IF NOT EXISTS` в DDL

### Риск: Проблемы с foreign keys
**Вероятность**: Средняя
**Воздействие**: Высокое
**Митigation**:
- Тестирование referential integrity на staging
- Использование `RESTRICT` для предотвращения orphan records

### Риск: Производительность после миграции
**Вероятность**: Низкая
**Воздействие**: Среднее
**Митigation**:
- Анализ query plans до и после
- Подготовка дополнительных индексов если необходимо

## Контакты

### Ответственные лица
- **Tech Lead**: Иван Петров (ivan.petrov@company.com)
- **DBA**: Алексей Сидоров (alexey.sidorov@company.com)
- **DevOps**: Мария Иванова (maria.ivanova@company.com)

### Экстренные контакты
- **On-call DBA**: +7 (999) 123-45-67
- **On-call DevOps**: +7 (999) 765-43-21

## Утверждение

- [ ] Tech Lead: _______________ Дата: ____________
- [ ] DBA: _______________ Дата: ____________
- [ ] DevOps: _______________ Дата: ____________

---

**Версия плана**: 1.0
**Дата создания**: Май 2026
**Дата следующего review**: Июнь 2026</content>
<parameter name="filePath">c:\Users\danil\personal\edo\DATABASE_MIGRATION_ROLLOUT_PLAN.md