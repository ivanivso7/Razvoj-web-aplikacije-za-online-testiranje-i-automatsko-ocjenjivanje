import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull().default(''),
  passwordSalt: text('password_salt').notNull().default(''),
  role: text('role', { enum: ['student', 'profesor'] }).notNull().default('student'),
  study: text('study').notNull().default('Informatika'),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').notNull(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
}, (table) => [uniqueIndex('idx_sessions_token').on(table.token), index('idx_sessions_user_id').on(table.userId)]);

export const tests = sqliteTable('tests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  teacherId: integer('teacher_id').notNull().references(() => users.id),
}, (table) => [index('idx_tests_subject').on(table.subject), index('idx_tests_teacher').on(table.teacherId)]);

export const questions = sqliteTable('questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['mcq', 'short', 'code'] }).notNull(),
  prompt: text('prompt').notNull(),
  optionsJson: text('options_json'),
  correctAnswer: text('correct_answer').notNull(),
  points: integer('points').notNull(),
  position: integer('position').notNull(),
}, (table) => [index('idx_questions_test_position').on(table.testId, table.position)]);

export const attempts = sqliteTable('attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id').notNull().references(() => tests.id),
  studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull(),
  submittedAt: text('submitted_at').notNull(),
}, (table) => [index('idx_attempts_student_date').on(table.studentId, table.submittedAt), index('idx_attempts_test').on(table.testId)]);

export const answers = sqliteTable('answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  attemptId: integer('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id),
  answer: text('answer').notNull(),
  awardedPoints: integer('awarded_points').notNull(),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
}, (table) => [index('idx_answers_attempt').on(table.attemptId)]);
