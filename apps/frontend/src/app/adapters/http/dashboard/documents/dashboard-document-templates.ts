import {
  DashboardDocumentCategory,
  DashboardRichContentDocument,
} from '../../../../domain/dashboard/dashboard.models';

export interface DashboardDocumentTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: DashboardDocumentCategory;
  readonly content: DashboardRichContentDocument;
}

export const DASHBOARD_DOCUMENT_TEMPLATES: Array<DashboardDocumentTemplate> = [
  {
    id: 'blank_ru',
    name: 'Пустой документ',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
  },
  {
    id: 'vacation_ru',
    name: 'Заявление на отпуск',
    category: 'HR',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: {
            level: 1,
            textAlign: 'center',
          },
          content: [{ type: 'text', text: 'ЗАЯВЛЕНИЕ' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Прошу предоставить мне ежегодный оплачиваемый отпуск с «___» ________ 20__ г. по «___» ________ 20__ г.',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'На период отпуска обязанности прошу возложить на ____________________________.',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Подпись: ____________________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Дата: «___» __________ 20__ г.' }],
        },
      ],
    },
  },
  {
    id: 'service_request_ru',
    name: 'Служебная заявка',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [{ type: 'text', text: 'СЛУЖЕБНАЯ ЗАЯВКА' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'на согласование условий, бюджета и сроков' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Инициатор: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Дата: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Обоснование: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Подпись: ______________________' }],
        },
      ],
    },
  },
  {
    id: 'guar_s_passport_fire_door_ru',
    name: 'Guar-S: паспорт изделия на противопожарную дверь',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [{ type: 'text', text: 'ПАСПОРТ ИЗДЕЛИЯ' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'Противопожарная металлическая дверь Guar-S EI-60',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Обозначение изделия: ДПМ-EI60-_____/_____' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Заводской номер: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Дата выпуска: «___» __________ 20__ г.' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Номер партии: ______________________' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '1. Основные характеристики' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Тип конструкции: однопольная / двупольная. Предел огнестойкости: EI-60. Исполнение: левое / правое. Наружное покрытие: порошковое. Комплектация: коробка, полотно, петли, замок, доводчик, терморасширяющаяся лента, уплотнитель.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '2. Сопроводительная документация' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Изделие изготовлено по утвержденной конструкторской документации и сопровождается паспортом, маркировкой, инструкцией по монтажу и документом о приемке ОТК.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '3. Отметка о приемке' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            { type: 'text', text: 'Изделие проверено, признано годным и допущено к отгрузке.' },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Контролер ОТК: ______________________' }],
        },
      ],
    },
  },
  {
    id: 'guar_s_quality_certificate_ru',
    name: 'Guar-S: сертификат качества партии',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [{ type: 'text', text: 'СЕРТИФИКАТ КАЧЕСТВА ПАРТИИ' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'продукции Guar-S' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Наименование продукции: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Исполнение: противопожарная дверь / противопожарный люк / противопожарные ворота',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Номер заказа: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Номер партии: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Количество изделий в партии: ______________________' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '1. Контролируемые показатели' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Проверены комплектность, геометрические размеры, качество сварных соединений, состояние защитно-декоративного покрытия, маркировка, комплект фурнитуры и результаты приемо-сдаточного контроля.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '2. Заключение' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Партия соответствует требованиям внутренней нормативной документации Guar-S и может быть передана на склад готовой продукции либо отгружена заказчику.',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Начальник ОТК: ______________________' }],
        },
      ],
    },
  },
  {
    id: 'guar_s_nonconformity_report_ru',
    name: 'Guar-S: акт о несоответствии продукции',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [{ type: 'text', text: 'АКТ О НЕСООТВЕТСТВИИ ПРОДУКЦИИ' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'Guar-S' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Дата выявления: «___» __________ 20__ г.' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Подразделение: производство / ОТК / склад / монтаж' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Наименование изделия: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Номер заказа / партии: ______________________' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '1. Описание несоответствия' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Зафиксировано отклонение по геометрическим размерам, комплектации, качеству покрытия, маркировке, сварным соединениям либо работоспособности фурнитуры.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '2. Предварительная классификация' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Критичность: критическое / значительное / малозначительное. Решение: доработка / сортировка / перевод в брак / повторный контроль.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '3. Корректирующие действия' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Ответственный за устранение: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Подпись контролера: ______________________' }],
        },
      ],
    },
  },
  {
    id: 'guar_s_certification_request_ru',
    name: 'Guar-S: заявка на сертификационные испытания',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [{ type: 'text', text: 'ЗАЯВКА НА СЕРТИФИКАЦИОННЫЕ ИСПЫТАНИЯ' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            { type: 'text', text: 'для органа по сертификации / испытательной лаборатории' },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Заявитель: ООО «Guar-S»' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Наименование продукции: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Тип продукции: дверь противопожарная металлическая / люк противопожарный металлический / ворота противопожарные',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Идентификация образца: ______________________' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '1. Цель испытаний' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Подтверждение соответствия продукции установленным требованиям по показателям огнестойкости, комплектности, маркировки и эксплуатационной документации.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '2. Прилагаемые документы' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Прилагаются чертеж общего вида, спецификация, паспорт изделия, руководство по монтажу и эксплуатации, фотографии образца, протоколы внутреннего контроля и иные документы по перечню.',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Ответственный исполнитель: ______________________' }],
        },
      ],
    },
  },
  {
    id: 'guar_s_production_order_ru',
    name: 'Guar-S: производственное задание на заказ',
    category: 'GENERAL',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: 'center' },
          content: [{ type: 'text', text: 'ПРОИЗВОДСТВЕННОЕ ЗАДАНИЕ' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'на изготовление продукции Guar-S' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Номер заказа: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Заказчик: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Продукция: дверь противопожарная EI-60 / люк противопожарный EI-60 / ворота противопожарные',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Количество: ______________________' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [{ type: 'text', text: 'Срок изготовления: ______________________' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '1. Технические параметры' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Размеры по проему, тип открывания, исполнение по стороне, цвет покрытия, состав фурнитуры, наличие остекления, вентиляционных решеток и дополнительных элементов указываются в спецификации заказа.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2, textAlign: 'left' },
          content: [{ type: 'text', text: '2. Маршрут исполнения' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'left' },
          content: [
            {
              type: 'text',
              text: 'Участки: заготовка металла, сварка, зачистка, окраска, сборка, комплектование, ОТК, склад готовой продукции.',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'right' },
          content: [{ type: 'text', text: 'Мастер смены: ______________________' }],
        },
      ],
    },
  },
];
