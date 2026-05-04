# Руководство разработчика: Интеграция с API оркестрации задач

## Обзор

API оркестрации задач предоставляет полный набор endpoints для создания, управления и отслеживания задач с поддержкой прикрепления документов и рабочих процессов одобрения.

## Базовая информация

- **Базовый URL**: `http://localhost:3000/api`
- **Аутентификация**: Через Keycloak OAuth2 + сессионные cookie
- **Формат данных**: JSON
- **Кодировка**: UTF-8

## Основные endpoints

### Управление досками

#### Получение списка досок
```http
GET /api/boards?organizationId={orgId}&limit=50&offset=0
```

**Параметры:**
- `organizationId` (string, required): Идентификатор организации
- `limit` (integer, optional): Максимальное количество досок (по умолчанию 50, макс 100)
- `offset` (integer, optional): Смещение для пагинации (по умолчанию 0)

**Ответ:**
```json
{
  "boards": [
    {
      "id": "board-123",
      "organizationId": "org-456",
      "name": "Основная доска",
      "description": "Канбан-доска для основных задач",
      "membersCount": 15,
      "tasksCount": 42
    }
  ],
  "total": 1,
  "page": 0,
  "pageSize": 50
}
```

#### Получение деталей доски
```http
GET /api/boards/{boardId}
```

**Ответ включает:**
- Информацию о доске
- Список участников
- Все задачи на доске
- Доступных одобряющих
- Доступные документы для прикрепления

### Создание задач

#### Создание новой задачи
```http
POST /api/tasks
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "title": "Подготовить отчет о продажах",
  "description": "Необходимо подготовить квартальный отчет с анализом продаж",
  "assigneeId": "user-123",
  "assigneeName": "Иван Петров",
  "approverId": "user-456",
  "approverName": "Мария Сидорова",
  "taskType": "approval",
  "dueDate": "2026-06-01",
  "priority": 3,
  "attachmentIds": ["doc-789", "doc-101"]
}
```

**Поля:**
- `title` (string, required): Название задачи (3-200 символов)
- `description` (string, optional): Описание (макс 2000 символов)
- `assigneeId` (string, required): ID исполнителя
- `assigneeName` (string, required): Имя исполнителя
- `approverId` (string, optional): ID одобряющего (обязательно для approval задач)
- `approverName` (string, optional): Имя одобряющего
- `taskType` (enum, required): "general" или "approval"
- `dueDate` (string, optional): Срок выполнения в формате YYYY-MM-DD
- `priority` (integer, optional): Приоритет 1-5
- `attachmentIds` (array, optional): Массив ID документов для прикрепления

### Обновление статуса задач

#### Изменение статуса задачи
```http
PATCH /api/tasks/{taskId}/status
Content-Type: application/json
```

**Для обычного перемещения:**
```json
{
  "status": "in_review"
}
```

**Для одобрения:**
```json
{
  "status": "approved",
  "decision": "approved"
}
```

**Для отклонения:**
```json
{
  "status": "declined",
  "decision": "declined",
  "decisionComment": "Необходимо доработать отчет согласно требованиям"
}
```

### Работа с прикреплениями

#### Добавление прикреплений
```http
POST /api/tasks/{taskId}/attachments
Content-Type: application/json
```

```json
{
  "documentIds": ["doc-123", "doc-456"]
}
```

#### Удаление прикрепления
```http
DELETE /api/tasks/{taskId}/attachments/{documentId}
```

### Получение справочников

#### Доступные одобряющие
```http
GET /api/tasks/available-approvers?boardId={boardId}&limit=20
```

#### Доступные документы
```http
GET /api/tasks/available-documents?boardId={boardId}&category=FINANCE&limit=20
```

## Типы данных

### Статусы задач
- `pending`: Ожидает проверки
- `in_review`: На проверке
- `approved`: Одобрено
- `declined`: Отклонено

### Типы задач
- `general`: Общая задача
- `approval`: Требует одобрения

### Группировка в канбан
- `assignee`: По исполнителю
- `department`: По подразделению
- `group`: По группе задач

## Обработка ошибок

API возвращает стандартные HTTP статусы:

- `200`: Успешный запрос
- `201`: Ресурс создан
- `204`: Ресурс удален (без тела ответа)
- `400`: Неверный запрос (валидация не прошла)
- `401`: Не авторизован
- `403`: Доступ запрещен
- `404`: Ресурс не найден
- `409`: Конфликт версий (для документов)
- `503`: Сервис недоступен

**Формат ошибок:**
```json
{
  "error": "board not found"
}
```

## Примеры интеграции

### JavaScript/TypeScript клиент

```typescript
// Получение досок организации
async function getBoards(organizationId: string) {
  const response = await fetch(`/api/boards?organizationId=${organizationId}`, {
    credentials: 'include' // Для сессионных cookie
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Создание задачи
async function createTask(boardId: string, taskData: CreateTaskRequest) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(taskData)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Одобрение задачи
async function approveTask(taskId: string, comment?: string) {
  const response = await fetch(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      status: 'approved',
      decision: 'approved',
      decisionComment: comment
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
```

### Обработка валидационных ошибок

```typescript
try {
  await createTask(boardId, taskData);
} catch (error) {
  if (error.message.includes('400')) {
    // Показать ошибки валидации пользователю
    showValidationErrors(error.details);
  } else {
    // Общая ошибка
    showGenericError('Не удалось создать задачу');
  }
}
```

## Лучшие практики

### Производительность
- Используйте пагинацию для больших списков
- Кэшируйте справочники (доступные одобряющие, документы)
- Избегайте частых запросов деталей доски

### Обработка ошибок
- Всегда проверяйте HTTP статус перед обработкой ответа
- Предоставляйте понятные сообщения об ошибках пользователям
- Реализуйте повторные попытки для сетевых ошибок

### Безопасность
- Все запросы требуют аутентификации
- Проверяйте права доступа на клиенте и сервере
- Валидируйте все входные данные

### UX рекомендации
- Показывайте индикаторы загрузки для длительных операций
- Обновляйте UI оптимистично при успешных операциях
- Предоставляйте обратную связь о статусе операций

## Тестирование

### Модульное тестирование
```typescript
describe('TaskService', () => {
  it('should create task successfully', async () => {
    const taskData = {
      title: 'Test task',
      assigneeId: 'user-123',
      assigneeName: 'Test User',
      taskType: 'general'
    };

    const result = await taskService.createTask(taskData);
    expect(result.id).toBeDefined();
    expect(result.status).toBe('pending');
  });
});
```

### Интеграционное тестирование
```typescript
describe('Task API Integration', () => {
  it('should create and approve task', async () => {
    // Создать задачу
    const task = await api.createTask(taskData);

    // Одобрить задачу
    const approvedTask = await api.approveTask(task.id);

    expect(approvedTask.status).toBe('approved');
  });
});
```

## Поддержка версий

- **v0.1.0**: Начальная версия API оркестрации задач
- Все изменения backward-compatible
- Новые поля добавляются как optional

## Контакты

При возникновении вопросов:
- Документация API: `/api/docs` (Swagger UI)
- Техническая поддержка: dev-support@company.com
- Команда разработки: #dev-api-integration

---

*Версия документации: 0.1.0 (май 2026)*</content>
<parameter name="filePath">c:\Users\danil\personal\edo\TASK_ORCHESTRATION_API_INTEGRATION_GUIDE.md