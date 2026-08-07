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
import { DAYS } from '../types'
import type { DayOfWeek, TaskCard } from '../types'

export default function TaskBoard() {
  const [tasks, setTasks] = useState<TaskCard[]>([])
  const [loading, setLoading] = useState(true)
  const { profiles } = useProfiles()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newTaskDay, setNewTaskDay] = useState<DayOfWeek | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

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

  async function addTask(day: DayOfWeek) {
    if (!newTaskTitle.trim()) return
    const dayTasks = tasks.filter((t) => t.dia_semana === day)
    const maxPos = dayTasks.length ? Math.max(...dayTasks.map((t) => t.posicion)) : 0
    await supabase.from('tasks').insert({
      dia_semana: day,
      titulo: newTaskTitle.trim(),
      posicion: maxPos + 1,
    })
    setNewTaskTitle('')
    setNewTaskDay(null)
    load()
  }

  async function toggleComplete(task: TaskCard) {
    await supabase
      .from('tasks')
      .update({
        completada: !task.completada,
        fecha_completada: !task.completada ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
    load()
  }

  async function assignTask(taskId: string, userId: string | null) {
    await supabase.from('tasks').update({ asignado_a: userId }).eq('id', taskId)
    load()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
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
              addingHere={newTaskDay === day.key}
              onStartAdd={() => setNewTaskDay(day.key)}
              onCancelAdd={() => {
                setNewTaskDay(null)
                setNewTaskTitle('')
              }}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              onSubmitAdd={() => addTask(day.key)}
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
  addingHere: boolean
  onStartAdd: () => void
  onCancelAdd: () => void
  newTaskTitle: string
  setNewTaskTitle: (v: string) => void
  onSubmitAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day })

  return (
    <div
      ref={setNodeRef}
      className={`bg-cream border border-line rounded-2xl p-3 min-h-[200px] flex flex-col ${
        isOver ? 'ring-2 ring-terracotta' : ''
      }`}
    >
      <h2 className="font-semibold text-ink px-2 py-1">{label}</h2>
      <div className="flex-1 space-y-2 mt-1">
        {tasks.map((task) => (
          <TaskCardItem
            key={task.id}
            task={task}
            profiles={profiles}
            onToggle={onToggle}
            onAssign={onAssign}
            onDelete={onDelete}
          />
        ))}
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
