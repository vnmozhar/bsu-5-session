import { useMemo, useState } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CalendarOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  officialSchedule,
  preliminarySchedule,
  publicSubjects,
} from './data/publicSubjects'
import './App.css'

const { Paragraph, Text, Title } = Typography
const weekdayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

function parseScheduleDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatScheduleDate(date: string) {
  return parseScheduleDate(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function App() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'
  const isSubjectPath = currentPath.startsWith('/subjects/')
  const isSchedulePath = currentPath === '/schedule'
  const selectedSubject = publicSubjects.find(
    (subject) => currentPath === `/subjects/${subject.id}`,
  )
  const hasOfficialSchedule = officialSchedule.length > 0
  const calendarEvents = hasOfficialSchedule
    ? officialSchedule.map((event) => ({
        date: event.date,
        kind: event.kind,
        detail: `${event.time} · ${event.subject} · ${event.group} · ${event.location}`,
      }))
    : preliminarySchedule
  const [selectedDate, setSelectedDate] = useState(
    calendarEvents[0]?.date ?? '',
  )
  const calendarMonths = Array.from(
    new Set(calendarEvents.map((event) => event.date.slice(0, 7))),
  ).map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const dayCount = new Date(year, month, 0).getDate()

    return {
      key: monthKey,
      title: firstDay.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      }),
      days: [
        ...Array.from({ length: startOffset }, () => null),
        ...Array.from({ length: dayCount }, (_, index) => index + 1),
      ],
    }
  })
  const selectedEvents = calendarEvents.filter(
    (event) => event.date === selectedDate,
  )

  const filteredSubjects = useMemo(
    () =>
      publicSubjects.filter((subject) =>
        [
          subject.name,
          subject.department ?? '',
          subject.instructor.name,
          subject.instructor.position,
          subject.assessment.type,
          subject.assessment.format,
          ...subject.courseInfo.map((item) => item.text),
          ...subject.requirements.map((item) => item.text),
          ...subject.topicGroups.flatMap((item) => [item.title, item.detail]),
          ...subject.topicItems,
          ...(subject.materials ?? []).map((item) => item.title),
          ...subject.analysis,
        ].some((value) => value.toLocaleLowerCase('ru').includes(normalizedQuery)),
      ),
    [normalizedQuery],
  )

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#285a47',
          colorText: '#1e3028',
          colorTextSecondary: '#65736c',
          colorBgLayout: '#f5f6f2',
          colorBorderSecondary: '#e8ece6',
          borderRadius: 16,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <main className="dashboard">
        {!isSubjectPath && !isSchedulePath && <section className="hero">
          <div className="hero-content">
            <Tag className="eyebrow">
              <BookOutlined /> Учебная навигация
            </Tag>
            <Title level={1}>Учебная сессия</Title>
            <Paragraph className="hero-description">
              Предварительные даты, форматы аттестации и сведения о требованиях
              по предметам. Для каждого указаны источники информации и то, что
              еще нужно подтвердить.
            </Paragraph>
            <div className="hero-meta">
              <span className="hero-dot" />
              <Text>Публичная информация о дисциплинах</Text>
            </div>
          </div>
          <div className="hero-mark" aria-hidden="true">
            <BookOutlined />
          </div>
        </section>}

        {!isSubjectPath && !isSchedulePath && (
          <section className="schedule-panel" aria-labelledby="schedule-title">
            <div className="schedule-heading">
              <div className="schedule-title-wrap">
                <span className="schedule-icon">
                  <CalendarOutlined />
                </span>
                <div>
                  <Text className="section-kicker">СЕССИЯ 2026</Text>
                  <Title id="schedule-title" level={2}>
                    Календарь сессии
                  </Title>
                </div>
              </div>
              <div className="schedule-actions">
                <Tag color={hasOfficialSchedule ? 'green' : 'gold'}>
                  {hasOfficialSchedule ? 'Опубликовано' : 'Предварительно'}
                </Tag>
                {hasOfficialSchedule && (
                  <a className="schedule-full-link" href="/schedule">
                    Полное расписание <ArrowRightOutlined />
                  </a>
                )}
              </div>
            </div>
            <Alert
              className="schedule-alert"
              title={
                hasOfficialSchedule
                  ? 'Официальное расписание опубликовано'
                  : 'Расписание пока согласуется'
              }
              description={
                hasOfficialSchedule
                  ? 'Календарь показывает даты занятий. Откройте полное расписание, чтобы посмотреть время, предметы, группы и аудитории.'
                  : 'Пока известны только предварительные даты. Предметы, группы и время еще не подтверждены.'
              }
              showIcon
              type={hasOfficialSchedule ? 'success' : 'warning'}
            />
            <div className="calendar-layout">
              <div className="calendar-months">
                {calendarMonths.map((month) => (
                  <section
                    aria-label={`Календарь: ${month.title}`}
                    className="calendar-month"
                    key={month.key}
                  >
                    <Title level={3}>{month.title}</Title>
                    <div className="calendar-grid calendar-weekdays">
                      {weekdayLabels.map((weekday) => (
                        <Text key={weekday}>{weekday}</Text>
                      ))}
                    </div>
                    <div className="calendar-grid calendar-days">
                      {month.days.map((day, index) => {
                        if (day === null) {
                          return <span aria-hidden="true" key={`blank-${index}`} />
                        }

                        const date = `${month.key}-${String(day).padStart(2, '0')}`
                        const events = calendarEvents.filter(
                          (event) => event.date === date,
                        )

                        return events.length > 0 ? (
                          <button
                            aria-label={`${formatScheduleDate(date)}: ${events.map((event) => event.kind).join(', ')}`}
                            aria-pressed={selectedDate === date}
                            className={`calendar-day calendar-event-day${selectedDate === date ? ' is-selected' : ''}`}
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            title={events.map((event) => event.detail).join('; ')}
                            type="button"
                          >
                            <span>{day}</span>
                            <span className="calendar-event-marker" />
                          </button>
                        ) : (
                          <span className="calendar-day" key={date}>
                            {day}
                          </span>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <aside aria-live="polite" className="calendar-selection">
                <Text className="section-kicker">ВЫБРАННАЯ ДАТА</Text>
                {selectedDate ? (
                  <>
                    <Title level={3}>{formatScheduleDate(selectedDate)}</Title>
                    {selectedEvents.map((event) => (
                      <div className="calendar-event-detail" key={`${event.date}-${event.kind}-${event.detail}`}>
                        <Text className="schedule-date-kind">{event.kind}</Text>
                        <Text className="schedule-date-detail">{event.detail}</Text>
                      </div>
                    ))}
                  </>
                ) : (
                  <Text>Даты пока не указаны</Text>
                )}
              </aside>
            </div>
          </section>
        )}

        {isSchedulePath && (
          <section className="expanded-schedule" aria-labelledby="expanded-schedule-title">
            <a className="back-link" href="/">
              <ArrowLeftOutlined /> Календарь сессии
            </a>
            <Text className="section-kicker">СЕССИЯ 2026</Text>
            <Title id="expanded-schedule-title" level={2}>
              Полное расписание
            </Title>
            {hasOfficialSchedule ? (
              <div className="official-schedule-list">
                {officialSchedule.map((event) => (
                  <article className="official-schedule-item" key={`${event.date}-${event.time}-${event.group}`}>
                    <div>
                      <Text className="schedule-date-value">
                        {formatScheduleDate(event.date)}
                      </Text>
                      <Text className="schedule-date-kind">{event.kind}</Text>
                    </div>
                    <div className="official-schedule-details">
                      <Text strong>{event.time}</Text>
                      <Text>{event.subject}</Text>
                      <Text>{event.group}</Text>
                      <Text>{event.location}</Text>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty description="Официальное расписание еще не опубликовано" />
            )}
          </section>
        )}

        {!isSchedulePath && <section className="subjects-section" aria-labelledby="subjects-title">
          <div className="section-heading">
            {selectedSubject ? (
              <div className="subject-page-heading">
                <a className="back-link" href="/">
                  <ArrowLeftOutlined /> Все предметы
                </a>
                <Text className="section-kicker">СТРАНИЦА ПРЕДМЕТА</Text>
                <Title id="subjects-title" level={2}>
                  {selectedSubject.name}
                </Title>
                <Text type="secondary">Информация о курсе и материалы</Text>
              </div>
            ) : isSubjectPath ? (
              <div className="subject-page-heading">
                <a className="back-link" href="/">
                  <ArrowLeftOutlined /> Все предметы
                </a>
                <Title id="subjects-title" level={2}>
                  Предмет не найден
                </Title>
              </div>
            ) : (
              <>
                <div>
                  <Text className="section-kicker">ОБЗОР</Text>
                  <Title id="subjects-title" level={2}>
                    Учебные предметы
                  </Title>
                  <Text type="secondary">{publicSubjects.length} дисциплин</Text>
                </div>
                <Input
                  allowClear
                  aria-label="Поиск по предметам, преподавателям и информации курса"
                  className="subject-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Найти предмет, преподавателя или тему"
                  prefix={<SearchOutlined />}
                  value={query}
                />
              </>
            )}
          </div>

          {isSubjectPath && !selectedSubject ? (
            <Empty description="Проверьте ссылку на предмет" />
          ) : (selectedSubject ? [selectedSubject] : filteredSubjects).length > 0 ? (
            <Row gutter={[20, 20]} align="stretch">
              {(selectedSubject ? [selectedSubject] : filteredSubjects).map((subject) => (
                <Col key={subject.id} xs={24} sm={selectedSubject ? 24 : 12} xl={selectedSubject ? 24 : 8}>
                  <Card
                    className={`subject-card${selectedSubject ? ' subject-detail-card' : ''}`}
                    variant="borderless"
                  >
                    <div className="subject-card-heading">
                      <div className="subject-icon">
                        <BookOutlined />
                      </div>
                      <Tag className="subject-tag">Предмет</Tag>
                    </div>

                    {!selectedSubject && (
                      <a className="subject-page-link" href={`/subjects/${subject.id}`}>
                        Страница предмета <ArrowRightOutlined />
                      </a>
                    )}

                    <Title className="subject-title" level={3}>
                      {subject.name}
                    </Title>

                    <div className="assessment-info">
                      <Tag color={subject.assessment.type === 'Экзамен' ? 'blue' : 'green'}>
                        {subject.assessment.type}
                      </Tag>
                      <Text>{subject.assessment.format}</Text>
                    </div>

                    <div className="subject-facts">
                      <div>
                        <Text className="fact-label">Кафедра</Text>
                        <Text className="fact-value">
                          {subject.department ?? 'Информация не указана'}
                        </Text>
                      </div>
                      <div>
                        <Text className="fact-label">Преподаватель</Text>
                        <Text className="fact-value">
                          {subject.instructor.name}
                        </Text>
                        <Text className="instructor-position">
                          {subject.instructor.position}
                        </Text>
                      </div>
                    </div>

                    <div className="subject-sections">
                      <section className="detail-section course-info">
                        <div className="detail-heading">
                          <BookOutlined />
                          <Text strong>Информация курса</Text>
                        </div>
                        {subject.courseInfo.map((item) => (
                          <div className="course-note" key={item.text}>
                            <Paragraph className="course-note-text">
                              {item.text}
                            </Paragraph>
                            {item.caution && (
                              <Text className="course-note-caution">
                                {item.caution}
                              </Text>
                            )}
                          </div>
                        ))}
                        {subject.courseInfo.length === 0 && (
                          <Text className="empty-detail">
                            Дополнительных сведений преподавателя в доступных
                            материалах пока нет.
                          </Text>
                        )}
                      </section>

                      {subject.materials && subject.materials.length > 0 && (
                        <details className="detail-accordion material-accordion">
                          <summary>
                            Материалы курса ({subject.materials.length})
                          </summary>
                          <div className="accordion-content">
                            {subject.materials.map((material) => (
                              <div className="material-entry" key={material.href}>
                                <Text className="material-category">
                                  {material.category}
                                </Text>
                                <a
                                  className="material-link"
                                  download
                                  href={material.href}
                                >
                                  <FileTextOutlined />
                                  <span>{material.title}</span>
                                  <Text className="material-format">
                                    {material.format}
                                  </Text>
                                  <DownloadOutlined />
                                </a>
                                {material.caution && (
                                  <Text className="material-caution">
                                    {material.caution}
                                  </Text>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      <section className="detail-section">
                        <div className="detail-heading">
                          <BookOutlined />
                          <Text strong>Что требуется</Text>
                        </div>
                        {subject.requirements.map((item) => (
                          <div className="requirement-note" key={item.text}>
                            <div className="requirement-heading">
                              <Tag
                                color={
                                  item.status === 'Известно' ? 'green' : 'gold'
                                }
                              >
                                {item.status}
                              </Tag>
                            </div>
                            <Paragraph className="course-note-text">
                              {item.text}
                            </Paragraph>
                          </div>
                        ))}
                      </section>

                      {(subject.topicGroups.length > 0 ||
                        subject.topicItems.length > 0) && (
                        <details className="detail-accordion">
                          <summary>
                            {subject.topicListTitle ??
                              (subject.topicItems.length > 0
                                ? `Вопросы и темы (${subject.topicItems.length})`
                                : `Тематические блоки (${subject.topicGroups.length})`)}
                          </summary>
                          <div className="accordion-content">
                            {subject.topicGroups.map((group) => (
                              <div className="topic-group" key={group.title}>
                                <Text strong>{group.title}</Text>
                                <Text>{group.detail}</Text>
                              </div>
                            ))}
                            {subject.topicItems.length > 0 && (
                              <ol className="topic-list">
                                {subject.topicItems.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </details>
                      )}

                      {subject.analysis.length > 0 && (
                        <details className="detail-accordion">
                          <summary>Аналитика, предположения и пробелы</summary>
                          <div className="accordion-content">
                            {subject.analysis.map((item) => (
                              <Paragraph className="analysis-note" key={item}>
                                {item}
                              </Paragraph>
                            ))}
                          </div>
                        </details>
                      )}

                      <section className="detail-section">
                        <div className="detail-heading">
                          <LinkOutlined />
                          <Text strong>Полезные ссылки</Text>
                        </div>
                        {subject.portalUrl ? (
                          <a
                            className="detail-link"
                            href={subject.portalUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Учебный портал
                          </a>
                        ) : (
                          <Text className="empty-detail">
                            Ссылка на учебный портал не добавлена
                          </Text>
                        )}
                        {subject.links.map((link) => (
                          <a
                            className="detail-link"
                            href={link.url}
                            key={link.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {link.title}
                          </a>
                        ))}
                        {subject.links.length === 0 && (
                          <Text className="empty-detail">
                            Других ссылок пока нет
                          </Text>
                        )}
                      </section>

                      <section className="detail-section comments-section">
                        <div className="detail-heading">
                          <MessageOutlined />
                          <Text strong>Комментарии</Text>
                        </div>
                        {subject.comments.length > 0 ? (
                          subject.comments.map((comment) => (
                            <Paragraph className="comment" key={comment}>
                              {comment}
                            </Paragraph>
                          ))
                        ) : (
                          <Text className="empty-detail">
                            Публичных комментариев пока нет
                          </Text>
                        )}
                      </section>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty
              className="empty-search"
              description="По вашему запросу ничего не найдено"
            />
          )}
        </section>}

        {!isSubjectPath && !isSchedulePath && <footer className="dashboard-footer">
          <Space size={8}>
            <span className="footer-mark" />
            <Text type="secondary">
              Сведения о преподавателях взяты из расписания 2025-2026;
              продолжение преподавания подтверждено. Предварительные даты
              требуют сверки с официальным расписанием.
            </Text>
          </Space>
        </footer>}
      </main>
    </ConfigProvider>
  )
}

export default App
