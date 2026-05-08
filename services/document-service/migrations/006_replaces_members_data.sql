UPDATE organization_members
SET full_name = new_data.full_name,
    email = new_data.email
FROM (
    VALUES
        ('approver-001', 'Мария Курапова', 'Общий', 'maria.kurapova@example.com'),
        ('approver-002', 'Алексей Долматов', 'Финансы', 'alexey.dolmatov@example.com'),
        ('approver-003', 'Александр Ваш', 'Кадровый отдел', 'sashka.vash@example.com')
) AS new_data(user_id, full_name, department, email)
WHERE organization_members.user_id = new_data.user_id
  AND organization_members.organization_id = 'org-main';