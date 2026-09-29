const taskService = require('../src/services/taskService');

describe('taskService', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('getAll', () => {
    test('returns empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    test('returns all tasks', () => {
      const task1 = taskService.create({ title: 'Task 1' });
      const task2 = taskService.create({ title: 'Task 2' });
      expect(taskService.getAll()).toHaveLength(2);
      expect(taskService.getAll()).toContainEqual(task1);
      expect(taskService.getAll()).toContainEqual(task2);
    });

    test('returns copy of tasks array (not reference)', () => {
      taskService.create({ title: 'Task 1' });
      const tasks = taskService.getAll();
      tasks.push({ id: 'fake', title: 'Fake' });
      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('findById', () => {
    test('returns undefined when task not found', () => {
      expect(taskService.findById('nonexistent')).toBeUndefined();
    });

    test('returns task when found', () => {
      const created = taskService.create({ title: 'Test Task' });
      const found = taskService.findById(created.id);
      expect(found).toEqual(created);
    });
  });

  describe('getByStatus', () => {
    beforeEach(() => {
      taskService.create({ title: 'Todo 1', status: 'todo' });
      taskService.create({ title: 'Todo 2', status: 'todo' });
      taskService.create({ title: 'In Progress', status: 'in_progress' });
      taskService.create({ title: 'Done', status: 'done' });
    });

    test('returns tasks matching exact status', () => {
      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(2);
      expect(todoTasks.every(t => t.status === 'todo')).toBe(true);
    });

    test('returns empty array for unknown status', () => {
      expect(taskService.getByStatus('unknown')).toEqual([]);
    });

    test('returns tasks for in_progress status', () => {
      const inProgress = taskService.getByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].status).toBe('in_progress');
    });

    test('returns tasks for done status', () => {
      const done = taskService.getByStatus('done');
      expect(done).toHaveLength(1);
      expect(done[0].status).toBe('done');
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

    // FIXED: Tests updated to match correct 1-indexed pagination (offset = (page-1)*limit)
    test('returns first page with default limit (FIXED: page 1 starts at offset 0)', () => {
      const page1 = taskService.getPaginated(1, 10);
      expect(page1).toHaveLength(10);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[9].title).toBe('Task 10');
    });

    // FIXED: Tests updated to match correct 1-indexed pagination
    test('returns second page (FIXED: page 2 starts at offset 10)', () => {
      const page2 = taskService.getPaginated(2, 10);
      expect(page2).toHaveLength(5);
      expect(page2[0].title).toBe('Task 11');
      expect(page2[4].title).toBe('Task 15');
    });

    test('returns empty array for page beyond data', () => {
      const page3 = taskService.getPaginated(3, 10);
      expect(page3).toEqual([]);
    });

    // FIXED: Tests updated to match correct 1-indexed pagination
    test('handles limit larger than total', () => {
      const all = taskService.getPaginated(1, 20);
      expect(all).toHaveLength(15);
    });

    // FIXED: Tests updated - page 0 returns empty (no page 0 in 1-indexed pagination)
    test('page 0 returns empty (no page 0 in 1-indexed pagination)', () => {
      const page0 = taskService.getPaginated(0, 5);
      expect(page0).toEqual([]); // offset = -5, slice(-5, 0) returns empty
    });
  });

  describe('getStats', () => {
    test('returns zero counts when no tasks', () => {
      expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
    });

    test('counts tasks by status', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'todo' });
      taskService.create({ title: 'T3', status: 'in_progress' });
      taskService.create({ title: 'T4', status: 'done' });
      expect(taskService.getStats()).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 0 });
    });

    test('counts overdue tasks (dueDate in past, not done)', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const future = new Date(Date.now() + 86400000).toISOString();
      taskService.create({ title: 'Overdue', dueDate: past, status: 'todo' });
      taskService.create({ title: 'Not overdue', dueDate: future, status: 'todo' });
      taskService.create({ title: 'Done overdue', dueDate: past, status: 'done' });
      expect(taskService.getStats().overdue).toBe(1);
    });

    test('does not count tasks without dueDate as overdue', () => {
      taskService.create({ title: 'No due date', status: 'todo' });
      expect(taskService.getStats().overdue).toBe(0);
    });
  });

  describe('create', () => {
    test('creates task with required title only', () => {
      const task = taskService.create({ title: 'New Task' });
      expect(task).toMatchObject({
        title: 'New Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        completedAt: null,
      });
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
    });

    test('creates task with all fields', () => {
      const dueDate = new Date().toISOString();
      const task = taskService.create({
        title: 'Full Task',
        description: 'Description',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      });
      expect(task).toMatchObject({
        title: 'Full Task',
        description: 'Description',
        status: 'in_progress',
        priority: 'high',
        dueDate,
      });
    });

    test('generates unique IDs', () => {
      const t1 = taskService.create({ title: 'T1' });
      const t2 = taskService.create({ title: 'T2' });
      expect(t1.id).not.toBe(t2.id);
    });

    test('stores task in internal array', () => {
      const task = taskService.create({ title: 'Stored' });
      expect(taskService.getAll()).toContainEqual(task);
    });
  });

  describe('update', () => {
    let task;

    beforeEach(() => {
      task = taskService.create({ title: 'Original', status: 'todo', priority: 'low' });
    });

    test('returns null for non-existent task', () => {
      expect(taskService.update('nonexistent', { title: 'New' })).toBeNull();
    });

    test('updates title', () => {
      const updated = taskService.update(task.id, { title: 'Updated' });
      expect(updated.title).toBe('Updated');
      expect(taskService.findById(task.id).title).toBe('Updated');
    });

    test('updates status', () => {
      const updated = taskService.update(task.id, { status: 'in_progress' });
      expect(updated.status).toBe('in_progress');
    });

    test('updates priority', () => {
      const updated = taskService.update(task.id, { priority: 'high' });
      expect(updated.priority).toBe('high');
    });

    test('updates dueDate', () => {
      const dueDate = new Date().toISOString();
      const updated = taskService.update(task.id, { dueDate });
      expect(updated.dueDate).toBe(dueDate);
    });

    test('updates multiple fields at once', () => {
      const updated = taskService.update(task.id, { title: 'Multi', status: 'done', priority: 'high' });
      expect(updated).toMatchObject({ title: 'Multi', status: 'done', priority: 'high' });
    });

    test('preserves fields not in update', () => {
      const updated = taskService.update(task.id, { title: 'New' });
      expect(updated.description).toBe('');
      expect(updated.priority).toBe('low');
      expect(updated.createdAt).toBe(task.createdAt);
    });

    test('allows setting dueDate to null', () => {
      const withDate = taskService.create({ title: 'With Date', dueDate: new Date().toISOString() });
      const updated = taskService.update(withDate.id, { dueDate: null });
      expect(updated.dueDate).toBeNull();
    });
  });

  describe('remove', () => {
    test('returns false for non-existent task', () => {
      expect(taskService.remove('nonexistent')).toBe(false);
    });

    test('removes task and returns true', () => {
      const task = taskService.create({ title: 'To Remove' });
      expect(taskService.remove(task.id)).toBe(true);
      expect(taskService.findById(task.id)).toBeUndefined();
      expect(taskService.getAll()).toHaveLength(0);
    });

    test('does not affect other tasks', () => {
      const t1 = taskService.create({ title: 'Keep' });
      const t2 = taskService.create({ title: 'Remove' });
      taskService.remove(t2.id);
      expect(taskService.getAll()).toContainEqual(t1);
      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('completeTask', () => {
    test('returns null for non-existent task', () => {
      expect(taskService.completeTask('nonexistent')).toBeNull();
    });

    test('marks task as done and sets completedAt', () => {
      const task = taskService.create({ title: 'To Complete', status: 'todo', priority: 'high' });
      const completed = taskService.completeTask(task.id);
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('resets priority to medium (current behavior)', () => {
      const task = taskService.create({ title: 'High Priority', priority: 'high' });
      const completed = taskService.completeTask(task.id);
      expect(completed.priority).toBe('medium');
    });

    test('updates task in store', () => {
      const task = taskService.create({ title: 'Complete Me' });
      taskService.completeTask(task.id);
      const stored = taskService.findById(task.id);
      expect(stored.status).toBe('done');
      expect(stored.completedAt).toBeDefined();
    });

    test('works on already completed task', () => {
      const task = taskService.create({ title: 'Already Done', status: 'done' });
      const completed = taskService.completeTask(task.id);
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
    });
  });

  describe('_reset', () => {
    test('clears all tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      taskService._reset();
      expect(taskService.getAll()).toEqual([]);
    });
  });
});