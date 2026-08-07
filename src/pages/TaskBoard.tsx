import { useEffect, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import { useProfiles } from '../hooks/useProfiles'
import { useAuth } from '../context/AuthContext'
import { logActivity } from '../lib/activity'
import { DAYS } from '../types'
import type { DayOfWeek, TaskCard } from '../types'

export default function TaskBoard() {
  const [tasks, setTasks] = useState<TaskCard[]>([])
  const [loading, setLoading] = useState(true)
  const { profiles } = useProfiles()
  const { profile } = useAuth()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newTaskDay, setNewTaskDay] = useState<DayOfWeek | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [expandedDay, setExpandedDay] = useState<DayOfWeek | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*').order('posicion')
    setTasks((data as TaskCard[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addTask(day: DayOfWeek, title: string) {
    if (!title.trim()) return
    const dayTasks = tasks.filter((t) => t.dia_semana === day)
    const maxPos = dayTasks.length ? Math.max(...dayTasks.map((t) => t.posicion)) : 0
    await supabase.from('tasks').insert({
      dia_semana: day,
      titulo: title.trim(),
      posicion: maxPos + 1,
    })
    logActivity(profile, 'creó', 'tarea', title.trim())
    load()
  }

  async function toggleComplete(task: TaskCard) {
    const completando = !task.completada
    await supabase
      .from('tasks')
      .update({
        completada: completando,
        fecha_completada: completando ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
    if (completando) logActivity(profile, 'completó', 'tarea', task.titulo)
    load()
  }

  async function assignTask(taskId: string, userId: string | null) {
    await supabase.from('tasks').update({ asignado_a: userId }).eq('id', taskId)
    load()
  }

  async function moveTaskToDay(taskId: string, newDay: DayOfWeek) {
    await supabase.from('tasks').update({ dia_semana: newDay }).eq('id', taskId)
    load()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    const task = tasks.find((t) => t.id === taskId)
    await supabase.from('tasks').delete().eq('id', taskId)
    if (task) logActivity(profile, 'eliminó', 'tarea', task.titulo)
    load()
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const taskId = active.id as string
    const newDay = over.id as DayOfWeek
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.dia_semana === newDay) return

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, dia_semana: newDay } : t)))
    await supabase.from('tasks').update({ dia_semana: newDay }).eq('id', taskId)
    load()
  }

  const activeTask = tasks.find((t) => t.id === activeId)
  const expandedDayLabel = DAYS.find((d) => d.key === expandedDay)?.label

  if (loading) return <p className="text-ink-soft">Cargando...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-ink">Tablero semanal</h1>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {DAYS.map((day) => (
            <DayColumn
              key={day.key}
              day={day.key}
              label={day.label}
              tasks={tasks.filter((t) => t.dia_semana === day.key)}
              profiles={profiles}
              onToggle={toggleComplete}
              onAssign={assignTask}
              onDelete={deleteTask}
              onExpand={() => setExpandedDay(day.key)}
              addingHere={newTaskDay === day.key}
              onStartAdd={() => setNewTaskDay(day.key)}
              onCancelAdd={() => {
                setNewTaskDay(null)
                setNewTaskTitle('')
              }}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              onSubmitAdd={() => {
                addTask(day.key, newTaskTitle)
                setNewTaskTitle('')
                setNewTaskDay(null)
              }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="px-3 py-3 rounded-xl bg-paper border border-line shadow-lg text-sm font-medium text-ink">
              {activeTask.titulo}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {expandedDay && (
        <DayFullScreen
          day={expandedDay}
          label={expandedDayLabel ?? ''}
          tasks={tasks.filter((t) => t.dia_semana === expandedDay)}
          profiles={profiles}
          onToggle={toggleComplete}
          onAssign={assignTask}
          onDelete={deleteTask}
          onMoveDay={moveTaskToDay}
          onAddTask={(title) => addTask(expandedDay, title)}
          onClose={() => setExpandedDay(null)}
        />
      )}
    </div>
  )
}

function DayColumn({
  day,
  label,
  tasks,
  profiles,
  onToggle,
  onAssign,
  onDelete,
  onExpand,
  addingHere,
  onStartAdd,
  onCancelAdd,
  newTaskTitle,
  setNewTaskTitle,
  onSubmitAdd,
}: {
  day: DayOfWeek
  label: string
  tasks: TaskCard[]
  profiles: { id: string; nombre: string }[]
  onToggle: (task: TaskCard) => void
  onAssign: (taskId: string, userId: string | null) => void
  onDelete: (taskId: string) => void
  onExpand: () => void
  addingHere: boolean
  onStartAdd: () => void
  onCancelAdd: () => void
  newTaskTitle: string
  setNewTaskTitle: (v: string) => void
  onSubmitAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day })
  const visibleTasks = tasks.slice(0, 4)
  const hiddenCount = tasks.length - visibleTasks.length

  return (
    <div
      ref={setNodeRef}
      className={`bg-cream border border-line rounded-2xl p-3 min-h-[200px] flex flex-col ${
        isOver ? 'ring-2 ring-terracotta' : ''
      }`}
    >
      <div className="flex items-center justify-between px-2 py-1">
        <h2 className="font-semibold text-ink">
          {label}
          {tasks.length > 0 && <span className="text-ink-soft font-normal ml-1">({tasks.length})</span>}
        </h2>
        <button
          onClick={onExpand}
          className="text-ink-soft hover:text-terracotta text-lg leading-none px-1"
          aria-label={`Ver ${label} en pantalla completa`}
          title="Ver en pantalla completa"
        >
          ⤢
        </button>
      </div>
      <div className="flex-1 space-y-2 mt-1">
        {visibleTasks.map((task) => (
          <TaskCardItem
            key={task.id}
            task={task}
            profiles={profiles}
            onToggle={onToggle}
            onAssign={onAssign}
            onDelete={onDelete}
          />
        ))}
        {hiddenCount > 0 && (
          <button
            onClick={onExpand}
            className="w-full text-center py-2 text-sm font-medium text-terracotta hover:text-terracotta-dark"
          >
            + {hiddenCount} tarea{hiddenCount !== 1 && 's'} más
          </button>
        )}
      </div>
      {addingHere ? (
        <div className="mt-2 space-y-2">
          <input
            autoFocus
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitAdd()
              if (e.key === 'Escape') onCancelAdd()
            }}
            placeholder="Nueva tarea..."
            className="w-full px-3 py-2 rounded-lg border border-line text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={onSubmitAdd}
              className="flex-1 py-1.5 rounded-lg bg-terracotta text-white text-sm font-medium"
            >
              Agregar
            </button>
            <button onClick={onCancelAdd} className="px-3 py-1.5 rounded-lg text-ink-soft text-sm">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onStartAdd}
          className="mt-2 text-left px-2 py-2 text-sm font-medium text-ink-soft hover:text-terracotta"
        >
          + Agregar tarea
        </button>
      )}
    </div>
  )
}

function TaskCardItem({
  task,
  profiles,
  onToggle,
  onAssign,
  onDelete,
}: {
  task: TaskCard
  profiles: { id: string; nombre: string }[]
  onToggle: (task: TaskCard) => void
  onAssign: (taskId: string, userId: string | null) => void
  onDelete: (taskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined
  const assignedName = profiles.find((p) => p.id === task.asignado_a)?.nombre

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-3 py-2.5 rounded-xl bg-paper border border-line shadow-sm"
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-ink-soft mt-0.5 shrink-0"
          aria-label="Mover tarea"
        >
          ⠿
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium break-words ${
              task.completada ? 'line-through text-ink-soft' : 'text-ink'
            }`}
          >
            {task.titulo}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <select
              value={task.asignado_a ?? ''}
              onChange={(e) => onAssign(task.id, e.target.value || null)}
              className="text-xs border border-line rounded-md px-1.5 py-1 text-ink-soft bg-transparent"
            >
              <option value="">Sin asignar</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {assignedName && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage/20 text-sage-dark">
                {assignedName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onToggle(task)}
              className="text-xs font-medium text-terracotta hover:text-terracotta-dark"
            >
              {task.completada ? 'Reabrir' : 'Completar'}
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="text-xs font-medium text-rose hover:text-rose/70"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Vista de un día en pantalla completa: se usa cuando la columna compacta
// del tablero semanal se queda corta de espacio para muchas tareas.
function DayFullScreen({
  day,
  label,
  tasks,
  profiles,
  onToggle,
  onAssign,
  onDelete,
  onMoveDay,
  onAddTask,
  onClose,
}: {
  day: DayOfWeek
  label: string
  tasks: TaskCard[]
  profiles: { id: string; nombre: string }[]
  onToggle: (task: TaskCard) => void
  onAssign: (taskId: string, userId: string | null) => void
  onDelete: (taskId: string) => void
  onMoveDay: (taskId: string, newDay: DayOfWeek) => void
  onAddTask: (title: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')

  function submit() {
    if (!title.trim()) return
    onAddTask(title)
    setTitle('')
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-cream z-50 flex flex-col">
      <div className="border-b border-line bg-paper px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <h2 className="text-2xl sm:text-3xl font-semibold text-ink">{label}</h2>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-ink-soft hover:text-ink hover:bg-cream text-lg font-medium"
        >
          Cerrar ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {tasks.length === 0 && (
            <p className="text-ink-soft text-center py-12">Sin tareas para este día todavía.</p>
          )}
          {tasks.map((task) => {
            const assignedName = profiles.find((p) => p.id === task.asignado_a)?.nombre
            return (
              <div
                key={task.id}
                className="bg-paper border border-line rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <p
                  className={`flex-1 text-lg font-medium break-words ${
                    task.completada ? 'line-through text-ink-soft' : 'text-ink'
                  }`}
                >
                  {task.titulo}
                </p>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <select
                    value={task.asignado_a ?? ''}
                    onChange={(e) => onAssign(task.id, e.target.value || null)}
                    className="text-sm border border-line rounded-lg px-3 py-2 text-ink-soft bg-transparent"
                  >
                    <option value="">Sin asignar</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  {assignedName && (
                    <span className="text-xs px-2 py-1 rounded-full bg-sage/20 text-sage-dark">
                      {assignedName}
                    </span>
                  )}
                  <select
                    value={day}
                    onChange={(e) => onMoveDay(task.id, e.target.value as DayOfWeek)}
                    className="text-sm border border-line rounded-lg px-3 py-2 text-ink-soft bg-transparent"
                    aria-label="Mover a otro día"
                  >
                    {DAYS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onToggle(task)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-terracotta hover:bg-terracotta/10"
                  >
                    {task.completada ? 'Reabrir' : 'Completar'}
                  </button>
                  <button
                    onClick={() => onDelete(task.id)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-rose hover:bg-rose/10"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-line bg-paper px-4 sm:px-8 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Nueva tarea para este día..."
            className="flex-1 px-4 py-3 rounded-xl border border-line text-lg"
          />
          <button
            onClick={submit}
            className="px-6 py-3 rounded-xl bg-terracotta text-white font-medium text-lg hover:bg-terracotta-dark"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
