const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('API Routes', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    test('returns empty array when no tasks', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns all tasks', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    test('filters by status query param', async () => {
      taskService.create({ title: 'Todo', status: 'todo' });
      taskService.create({ title: 'In Progress', status: 'in_progress' });
      taskService.create({ title: 'Done', status: 'done' });
      const res = await request(app).get('/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('todo');
    });

    test('returns empty array for non-matching status', async () => {
      taskService.create({ title: 'Task', status: 'todo' });
      const res = await request(app).get('/tasks?status=in_progress');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('paginates with page and limit (FIXED: page 1 returns first items)', async () => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }
      const res = await request(app).get('/tasks?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
      expect(res.body[0].title).toBe('Task 1');
    });

    test('returns second page (FIXED: page 2 returns next items)', async () => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }
      const res = await request(app).get('/tasks?page=2&limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
      expect(res.body[0].title).toBe('Task 6');
    });

    test('returns empty array for page beyond data', async () => {
      taskService.create({ title: 'Task 1' });
      const res = await request(app).get('/tasks?page=5&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('status filter takes precedence over pagination', async () => {
      taskService.create({ title: 'Todo 1', status: 'todo' });
      taskService.create({ title: 'Todo 2', status: 'todo' });
      taskService.create({ title: 'In Progress', status: 'in_progress' });
      const res = await request(app).get('/tasks?status=todo&page=1&limit=1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('GET /tasks/stats', () => {
    test('returns zero counts when no tasks', async () => {
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
    });

    test('returns counts by status', async () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'todo' });
      taskService.create({ title: 'T3', status: 'in_progress' });
      taskService.create({ title: 'T4', status: 'done' });
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 0 });
    });

    test('counts overdue tasks', async () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      taskService.create({ title: 'Overdue', dueDate: past, status: 'todo' });
      taskService.create({ title: 'Not overdue', dueDate: new Date(Date.now() + 86400000).toISOString(), status: 'todo' });
      taskService.create({ title: 'Done overdue', dueDate: past, status: 'done' });
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body.overdue).toBe(1);
    });
  });

  describe('POST /tasks', () => {
    test('creates task with title only', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'New Task' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'New Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        completedAt: null,
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    test('creates task with all fields', async () => {
      const dueDate = new Date().toISOString();
      const res = await request(app)
        .post('/tasks')
        .send({
          title: 'Full Task',
          description: 'Description',
          status: 'in_progress',
          priority: 'high',
          dueDate,
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Full Task',
        description: 'Description',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      });
    });

    test('returns 400 when title missing', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ description: 'No title' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title is required');
    });

    test('returns 400 when title is empty string', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title is required');
    });

    test('returns 400 when title is whitespace only', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title is required');
    });

    test('returns 400 for invalid status', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Test', status: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of');
    });

    test('returns 400 for invalid priority', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Test', priority: 'urgent' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });

    test('returns 400 for invalid dueDate', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Test', dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate must be a valid ISO date string');
    });

    test('accepts valid ISO dueDate', async () => {
      const dueDate = new Date().toISOString();
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Test', dueDate });
      expect(res.status).toBe(201);
      expect(res.body.dueDate).toBe(dueDate);
    });

    test('accepts null dueDate', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Test', dueDate: null });
      expect(res.status).toBe(201);
      expect(res.body.dueDate).toBeNull();
    });
  });

  describe('PUT /tasks/:id', () => {
    let task;

    beforeEach(() => {
      task = taskService.create({ title: 'Original', status: 'todo', priority: 'low' });
    });

    test('updates task and returns 200', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    test('returns 404 for non-existent task', async () => {
      const res = await request(app)
        .put('/tasks/nonexistent')
        .send({ title: 'Updated' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('returns 400 for empty title', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title must be a non-empty string');
    });

    test('returns 400 for invalid status', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of');
    });

    test('returns 400 for invalid priority', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ priority: 'urgent' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of');
    });

    test('returns 400 for invalid dueDate', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dueDate must be a valid ISO date string');
    });

    test('updates multiple fields', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Multi', status: 'done', priority: 'high' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: 'Multi', status: 'done', priority: 'high' });
    });

    test('preserves unchanged fields', async () => {
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'New Title' });
      expect(res.body.description).toBe('');
      expect(res.body.priority).toBe('low');
      expect(res.body.createdAt).toBe(task.createdAt);
    });

    test('allows setting dueDate to null', async () => {
      const withDate = taskService.create({ title: 'With Date', dueDate: new Date().toISOString() });
      const res = await request(app)
        .put(`/tasks/${withDate.id}`)
        .send({ dueDate: null });
      expect(res.status).toBe(200);
      expect(res.body.dueDate).toBeNull();
    });
  });

  describe('DELETE /tasks/:id', () => {
    test('deletes task and returns 204', async () => {
      const task = taskService.create({ title: 'To Delete' });
      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(taskService.findById(task.id)).toBeUndefined();
    });

    test('returns 404 for non-existent task', async () => {
      const res = await request(app).delete('/tasks/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    // Second edge case: deleting the same task twice — second delete returns 404
    test('returns 404 when deleting the same task twice', async () => {
      const task = taskService.create({ title: 'Delete Twice' });
      const first = await request(app).delete(`/tasks/${task.id}`);
      expect(first.status).toBe(204);
      const second = await request(app).delete(`/tasks/${task.id}`);
      expect(second.status).toBe(404);
      expect(second.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    test('marks task as complete and returns 200', async () => {
      const task = taskService.create({ title: 'To Complete', status: 'todo', priority: 'high' });
      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(res.body.priority).toBe('medium');
    });

    test('returns 404 for non-existent task', async () => {
      const res = await request(app).patch('/tasks/nonexistent/complete');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('works on already completed task', async () => {
      const task = taskService.create({ title: 'Already Done', status: 'done' });
      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
    });
  });

  // NEW: Tests for PATCH /tasks/:id/assign endpoint (Part C feature)
  describe('PATCH /tasks/:id/assign', () => {
    let task;

    beforeEach(() => {
      task = taskService.create({ title: 'Task to Assign', status: 'todo' });
    });

    test('assigns task to user and returns 200 with updated task', async () => {
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'John Doe' });
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('John Doe');
      expect(res.body.id).toBe(task.id);
      expect(res.body.title).toBe('Task to Assign');
    });

    test('returns 404 for non-existent task', async () => {
      const res = await request(app)
        .patch('/tasks/nonexistent/assign')
        .send({ assignee: 'John Doe' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('returns 400 when assignee is missing', async () => {
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee is required');
    });

    test('returns 400 when assignee is empty string', async () => {
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee must be a non-empty string');
    });

    test('returns 400 when assignee is whitespace only', async () => {
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee must be a non-empty string');
    });

    test('returns 400 when assignee is not a string', async () => {
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('assignee must be a string');
    });

    test('overwrites existing assignee (re-assignment allowed)', async () => {
      // First assignment
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alice' });
      // Re-assign
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Bob' });
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    test('persists assignee in task store', async () => {
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Jane Smith' });
      const stored = taskService.findById(task.id);
      expect(stored.assignee).toBe('Jane Smith');
    });

    test('returns task with all original fields plus assignee', async () => {
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Test User' });
      expect(res.body).toMatchObject({
        id: task.id,
        title: 'Task to Assign',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        completedAt: null,
        assignee: 'Test User',
      });
      expect(res.body.createdAt).toBeDefined();
    });
  });
});