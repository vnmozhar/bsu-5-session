import { useMemo, useState } from 'react'
import {
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
import { preliminarySchedule, publicSubjects } from './data/publicSubjects'
import './App.css'

const { Paragraph, Text, Title } = Typography

function App() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')

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
        <section className="hero">
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
        </section>

        <section className="schedule-panel" aria-labelledby="schedule-title">
          <div className="schedule-heading">
            <div className="schedule-title-wrap">
              <span className="schedule-icon">
                <CalendarOutlined />
              </span>
              <div>
                <Text className="section-kicker">СЕССИЯ 2026</Text>
                <Title id="schedule-title" level={2}>
                  Предварительные даты
                </Title>
              </div>
            </div>
            <Tag color="gold">Неофициальная информация</Tag>
          </div>
          <Alert
            className="schedule-alert"
            title="Расписание пока согласуется"
            description="Даты не привязаны к конкретным предметам или группам. Ожидается публикация расписания 11 ноября. Время и распределение дисциплин пока неизвестны."
            showIcon
            type="warning"
          />
          <Row gutter={[12, 12]} className="schedule-dates">
            {preliminarySchedule.map((item) => (
              <Col key={item.date} xs={24} sm={12} xl={6}>
                <div className="schedule-date">
                  <Text className="schedule-date-value">{item.date}</Text>
                  <Text className="schedule-date-kind">{item.kind}</Text>
                  <Text className="schedule-date-detail">{item.detail}</Text>
                </div>
              </Col>
            ))}
          </Row>
        </section>

        <section className="subjects-section" aria-labelledby="subjects-title">
          <div className="section-heading">
            <div>
              <Text className="section-kicker">ОБЗОР</Text>
              <Title id="subjects-title" level={2}>
                Учебные предметы
              </Title>
              <Text type="secondary">
                {publicSubjects.length} дисциплин
              </Text>
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
          </div>

          {filteredSubjects.length > 0 ? (
            <Row gutter={[20, 20]} align="stretch">
              {filteredSubjects.map((subject) => (
                <Col key={subject.id} xs={24} sm={12} xl={8}>
                  <Card className="subject-card" variant="borderless">
                    <div className="subject-card-heading">
                      <div className="subject-icon">
                        <BookOutlined />
                      </div>
                      <Tag className="subject-tag">Предмет</Tag>
                    </div>

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
                              `Вопросы и темы (${subject.topicItems.length})`}
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
        </section>

        <footer className="dashboard-footer">
          <Space size={8}>
            <span className="footer-mark" />
            <Text type="secondary">
              Сведения о преподавателях взяты из расписания 2025-2026;
              продолжение преподавания подтверждено. Предварительные даты
              требуют сверки с официальным расписанием.
            </Text>
          </Space>
        </footer>
      </main>
    </ConfigProvider>
  )
}

export default App
