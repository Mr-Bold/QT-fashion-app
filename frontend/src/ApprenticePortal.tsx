import { useState } from 'react'
import { Check, Clock3, LogOut, Send } from 'lucide-react'
import type { WorkspaceApprentice, WorkspaceTask, WorkspaceTaskUpdate } from './lib/workspace'
import './ApprenticePortal.css'

type ApprenticePortalProps = {
  apprentice: WorkspaceApprentice
  tasks: WorkspaceTask[]
  updates: WorkspaceTaskUpdate[]
  onUpdate: (task: WorkspaceTask, status: WorkspaceTask['status'], comment: string) => Promise<void>
  onChecklistUpdate: (task: WorkspaceTask, checklist: WorkspaceTask['checklist']) => Promise<void>
  onSignOut: () => Promise<void>
}

export default function ApprenticePortal({ apprentice, tasks, updates, onUpdate, onChecklistUpdate, onSignOut }: ApprenticePortalProps) {
  const [comments, setComments] = useState<Record<string, string>>({})
  const [busyTaskId, setBusyTaskId] = useState('')
  const [checklistBusyTaskId, setChecklistBusyTaskId] = useState('')
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [error, setError] = useState('')
  const openTasks = tasks.filter((task) => task.status !== 'Done')
  const canUpdateTasks = apprentice.status === 'Active'

  async function submitUpdate(task: WorkspaceTask, status: WorkspaceTask['status']) {
    const taskKey = task.dbId ?? task.id
    setBusyTaskId(taskKey)
    setError('')
    try {
      await onUpdate(task, status, comments[taskKey] ?? '')
      setComments((current) => ({ ...current, [taskKey]: '' }))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'The task update could not be saved.')
    } finally {
      setBusyTaskId('')
    }
  }

  async function toggleChecklistItem(task: WorkspaceTask, itemId: string, completed: boolean) {
    const taskKey = task.dbId ?? task.id
    setChecklistBusyTaskId(taskKey)
    setError('')
    try {
      await onChecklistUpdate(task, task.checklist.map((item) => item.id === itemId ? { ...item, completed } : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'The checklist update could not be saved.')
    } finally {
      setChecklistBusyTaskId('')
    }
  }

  async function handleSignOut() {
    setSignOutBusy(true)
    try {
      await onSignOut()
    } finally {
      setSignOutBusy(false)
    }
  }

  return (
    <main className="apprentice-portal">
      <header className="apprentice-portal-header">
        <a className="apprentice-portal-brand" href="#tasks"><span>QT Fashion app</span><small>APPRENTICE WORKSPACE</small></a>
        <button className="apprentice-portal-signout" type="button" disabled={signOutBusy} aria-busy={signOutBusy || undefined} onClick={() => void handleSignOut()}>
          {signOutBusy ? <span className="button-processing-indicator"><span className="button-processing-spinner" aria-hidden="true" />Signing out…</span> : <><LogOut size={16} /> Sign out</>}
        </button>
      </header>
      <section className="apprentice-portal-content" aria-labelledby="apprentice-portal-title">
        <p className="apprentice-portal-kicker">YOUR WORKSPACE</p>
        <h1 id="apprentice-portal-title">Hello, {apprentice.name.split(/\s+/)[0]}</h1>
        <p className="apprentice-portal-intro">See your assigned work, share progress, and send finished work to the shop for review.</p>
        {!canUpdateTasks && <p className="apprentice-portal-waiting" role="status">Your account is on leave. You can review assigned work, but task updates are paused.</p>}
        <div className="apprentice-portal-summary">
          <article><span>Open tasks</span><strong>{openTasks.length}</strong></article>
          <article><span>Needs your action</span><strong>{tasks.filter((task) => ['To do', 'Revision requested'].includes(task.status)).length}</strong></article>
          <article><span>In review</span><strong>{tasks.filter((task) => task.status === 'Review').length}</strong></article>
        </div>
        {error && <p className="apprentice-portal-error" role="alert">{error}</p>}
        <div className="apprentice-portal-task-list">
          {tasks.map((task) => {
            const taskKey = task.dbId ?? task.id
            const history = updates.filter((update) => update.taskId === task.dbId).slice(0, 4)
            const busy = busyTaskId === taskKey
            return (
              <article className="apprentice-portal-task" key={taskKey}>
                <div className="apprentice-portal-task-heading">
                  <div>
                    <span className={`apprentice-portal-status ${task.status.toLowerCase().replaceAll(' ', '-')}`}>{task.status}</span>
                    <h2>{task.title}</h2>
                  </div>
                  <span className={`apprentice-portal-priority ${task.priority.toLowerCase()}`}>{task.priority} priority</span>
                </div>
                {task.description && <p className="apprentice-portal-task-description">{task.description}</p>}
                {task.checklist.length > 0 && (
                  <fieldset className="apprentice-portal-checklist" disabled={!canUpdateTasks || checklistBusyTaskId === taskKey}>
                    <legend>Task checklist</legend>
                    {task.checklist.map((item) => (
                      <label key={item.id}>
                        <input type="checkbox" checked={item.completed} onChange={(event) => void toggleChecklistItem(task, item.id, event.target.checked)} />
                        <span className={item.completed ? 'completed' : ''}>{item.label}</span>
                      </label>
                    ))}
                    {checklistBusyTaskId === taskKey && <span className="apprentice-portal-saving" role="status">Saving checklist…</span>}
                  </fieldset>
                )}
                <div className="apprentice-portal-task-meta">
                  <span><Clock3 size={14} /> Due {task.dueDate || 'No deadline'}</span>
                  {task.orderId && <span>Related order {task.orderId}</span>}
                </div>
                <label className="apprentice-portal-comment-label">
                  Progress note <span>optional</span>
                  <textarea
                    maxLength={500}
                    placeholder="Share a brief update for your supervisor"
                    value={comments[taskKey] ?? ''}
                    disabled={!canUpdateTasks}
                    onChange={(event) => setComments((current) => ({ ...current, [taskKey]: event.target.value }))}
                  />
                </label>
                <div className="apprentice-portal-actions">
                  {task.status === 'To do' && <button type="button" disabled={busy || !canUpdateTasks} aria-busy={busy || undefined} onClick={() => void submitUpdate(task, 'Accepted')}>{busy ? <span className="button-processing-indicator"><span className="button-processing-spinner" aria-hidden="true" />Saving…</span> : <><Check size={15} /> Accept task</>}</button>}
                  {task.status === 'Accepted' && <button type="button" disabled={busy || !canUpdateTasks} aria-busy={busy || undefined} onClick={() => void submitUpdate(task, 'In progress')}>{busy ? <span className="button-processing-indicator"><span className="button-processing-spinner" aria-hidden="true" />Saving…</span> : <><Check size={15} /> Start task</>}</button>}
                  {['In progress', 'Revision requested'].includes(task.status) && <button type="button" disabled={busy || !canUpdateTasks} aria-busy={busy || undefined} onClick={() => void submitUpdate(task, task.status === 'Revision requested' ? 'In progress' : 'Review')}>{busy ? <span className="button-processing-indicator"><span className="button-processing-spinner" aria-hidden="true" />Saving…</span> : <><Send size={15} /> {task.status === 'Revision requested' ? 'Resume work' : 'Submit for review'}</>}</button>}
                  {task.status === 'Review' && <span className="apprentice-portal-waiting">Waiting for the shop to review your work.</span>}
                  {task.status === 'Done' && <span className="apprentice-portal-complete"><Check size={15} /> Completed</span>}
                  {busy && <span className="apprentice-portal-saving" role="status">Saving…</span>}
                </div>
                {history.length > 0 && (
                  <ol className="apprentice-portal-history" aria-label={`Progress history for ${task.title}`}>
                    {history.map((update) => <li key={update.id}><strong>{update.newStatus}</strong><span>{update.comment || `${update.actor} updated this task`}</span><time>{new Date(update.createdAt).toLocaleString()}</time></li>)}
                  </ol>
                )}
              </article>
            )
          })}
          {tasks.length === 0 && <section className="apprentice-portal-empty"><h2>No tasks assigned yet</h2><p>New work from your shop will appear here.</p></section>}
        </div>
      </section>
    </main>
  )
}
