import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Users, Clock, CheckCircle, AlertTriangle, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useFetch, useMutation, useModal } from '../../hooks'
import { examsAPI, shiftsAPI, roomsAPI, classesAPI, sectionsAPI } from '../../api'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select } from '../../components/ui/Input'
import { ConfirmModal } from '../../components/shared/index.jsx'
import { Badge } from '../../components/ui/Loader'
import InvigilatorAssigner from '../../components/exam/InvigilatorAssigner'
import AlgorithmConfig from '../../components/exam/AlgorithmConfig'
import Loader from '../../components/ui/Loader'
import toast from 'react-hot-toast'

function ShiftForm({ defaultValues, rooms, classes, sections, onSubmit, loading, onCancel }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: defaultValues || {
      seatingRules: {
        classSeparationMode: 'strict',
        rollNumberOrder: true,
        genderSeparation: 'none',
        consecutivePairing: false,
        gapSeating: false,
        classPairs: [],
        groupBy: 'class',
      },
    },
  })
  const [rulesValue, setRulesValue] = useState(defaultValues?.seatingRules)
  const [selectedRooms, setSelectedRooms] = useState(defaultValues?.rooms || [])
  const [selectedClasses, setSelectedClasses] = useState(defaultValues?.selectedClassIds || [])
  const [selectedSections, setSelectedSections] = useState(defaultValues?.selectedSectionIds || [])

  const toggleClass = (id) => setSelectedClasses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleSection = (id) => setSelectedSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleRoom = (id) => {
    setSelectedRooms(prev => {
      const exists = prev.find(r => r.room === id || r.room?.id === id)
      if (exists) return prev.filter(r => (r.room?.id || r.room) !== id)
      return [...prev, { room: id, priority: prev.length + 1, usableCapacity: rooms.find(r => r.id === id)?.usableCapacity || 0 }]
    })
  }

  const isRoomSelected = (id) => selectedRooms.some(r => (r.room?.id || r.room) === id)

  const handleSubmitForm = (data) => {
    onSubmit({
      ...data,
      selectedClassIds: selectedClasses,
      selectedSectionIds: selectedSections,
      rooms: selectedRooms,
      seatingRules: rulesValue || data.seatingRules,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-3 gap-4">
        <Input label="Shift Name" required placeholder="Morning" error={errors.name?.message}
          {...register('name', { required: 'Required' })} />
        <Input label="Start Time" type="time" required error={errors.startTime?.message}
          {...register('startTime', { required: 'Required' })} />
        <Input label="End Time" type="time" required error={errors.endTime?.message}
          {...register('endTime', { required: 'Required' })} />
      </div>

      {/* Classes */}
      <div>
        <label className="label">Classes</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {classes?.map(c => (
            <button
              key={c.id} type="button"
              onClick={() => toggleClass(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${selectedClasses.includes(c.id) ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy'}`}
            >{c.name}</button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div>
        <label className="label">Sections (optional — leave empty to include all sections of selected classes)</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {sections?.filter(s => selectedClasses.length === 0 || selectedClasses.includes(s.classId || s.class?.id)).map(s => (
            <button
              key={s.id} type="button"
              onClick={() => toggleSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${selectedSections.includes(s.id) ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy'}`}
            >{s.class?.name ? `${s.class.name} - ${s.name}` : s.name}</button>
          ))}
        </div>
      </div>

      {/* Rooms */}
      <div>
        <label className="label">Rooms (select all rooms for this shift)</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {rooms?.map(r => (
            <button key={r.id} type="button"
              onClick={() => toggleRoom(r.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors
                ${isRoomSelected(r.id) ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy'}`}
            >
              <span className="font-medium">{r.name}</span>
              <span className={`ml-2 text-xs ${isRoomSelected(r.id) ? 'text-white/70' : 'text-gray-400'}`}>
                {r.usableCapacity} seats
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Seating rules */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Seating Rules</p>
        <div className="border border-gray-200 rounded-xl p-4">
          <AlgorithmConfig value={rulesValue} onChange={setRulesValue} classes={classes} />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>Save Shift</Button>
      </div>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ExamDetail() {
  const { examId } = useParams()
  const [activeTab, setActiveTab] = useState('shifts')
  const [activeShiftId, setActiveShiftId] = useState(null)
  const modal = useModal()
  const confirm = useModal()
  const { mutate, loading: ml } = useMutation()

  const { data: exam, loading: examLoading } = useFetch(() => examsAPI.list().then(r => {
    const list = r.data.data
    return { data: { data: list?.find?.(e => e.id === examId) } }
  }), [examId])

  const { data: shifts, loading: shLoading, refetch: refetchShifts } = useFetch(
    () => shiftsAPI.list(examId), [examId]
  )
  const { data: rooms } = useFetch(() => roomsAPI.list({ limit: 100 }))
  const { data: classes } = useFetch(() => classesAPI.list({ limit: 100 }))
  const { data: sections } = useFetch(() => sectionsAPI.list({ limit: 300 }))

  // Pick first shift as active by default
  const activeShift = (shifts || []).find(s => s.id === activeShiftId) || shifts?.[0]

  const handleSaveShift = (data) => {
    const fn = modal.data?.id
      ? () => shiftsAPI.update(examId, modal.data.id, data)
      : () => shiftsAPI.create(examId, data)
    mutate(fn, {
      successMsg: modal.data?.id ? 'Shift updated' : 'Shift created',
      onSuccess: () => { modal.close(); refetchShifts() },
    })
  }

  const handleDeleteShift = () => {
    mutate(() => shiftsAPI.delete(examId, confirm.data.id), {
      successMsg: 'Shift deleted',
      onSuccess: () => { confirm.close(); refetchShifts() },
    })
  }

  const handleResolveStudents = (shiftId) => {
    mutate(() => shiftsAPI.resolveStudents(examId, shiftId), {
      successMsg: 'Students resolved',
      onSuccess: () => refetchShifts(),
    })
  }

  if (examLoading) return <div className="flex justify-center py-20"><Loader text="Loading exam…" /></div>

  const tabs = ['shifts', 'invigilators']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link to="/admin/exams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={14} /> Back to Exams
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">{exam?.title || 'Exam Detail'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{exam?.academicYear} · {exam?.status}</p>
          </div>
          <Link to={`/admin/exams/${examId}/seating`}>
            <Button icon={Eye}>Manage Seating</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${activeTab === tab ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Shifts tab */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={Plus} size="sm" onClick={() => { modal.open(null) }}>Add Shift</Button>
          </div>

          {shLoading ? (
            <div className="flex justify-center py-10"><Loader /></div>
          ) : shifts?.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <Clock size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No shifts yet. Create a shift to define which students and rooms are in each session.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {shifts.map((shift) => (
                <div key={shift.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{shift.name}</h3>
                        {shift.isPublished && <Badge color="green">Published</Badge>}
                        {shift.planGenerated && !shift.isPublished && <Badge color="amber">Plan Ready</Badge>}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {shift.startTime} – {shift.endTime}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          <strong>{shift.totalStudents || 0}</strong> students ·{' '}
                          <strong>{shift.shiftRooms?.length || 0}</strong> rooms ·{' '}
                          <strong>{shift.totalAvailableSeats || 0}</strong> seats
                        </span>
                        {shift.selectedClassIds?.map(id => (
                          <Badge key={id} color="blue">{classes?.find(c => c.id === id)?.name || id}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => handleResolveStudents(shift.id)}>
                        Resolve Students
                      </Button>
                      <button
                        onClick={() => { modal.open(shift) }}
                        disabled={shift.isPublished}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => confirm.open(shift)}
                        disabled={shift.isPublished}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invigilators tab */}
      {activeTab === 'invigilators' && (
        <div className="space-y-4">
          {/* Shift selector */}
          {shifts?.length > 0 && (
            <div className="flex gap-2">
              {shifts.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveShiftId(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${(activeShiftId || shifts[0]?.id) === s.id ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-navy'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {activeShift ? (
            <InvigilatorAssigner
              examId={examId}
              shiftId={activeShift.id}
              rooms={activeShift.shiftRooms || []}
            />
          ) : (
            <div className="card p-10 text-center text-gray-400 text-sm">Create shifts first to assign invigilators</div>
          )}
        </div>
      )}

      {/* Shift form modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={modal.close}
        title={modal.data?.id ? 'Edit Shift' : 'Add Shift'}
        size="xl"
      >
        <ShiftForm
          defaultValues={modal.data}
          rooms={rooms || []}
          classes={classes || []}
          sections={sections || []}
          onSubmit={handleSaveShift}
          loading={ml}
          onCancel={modal.close}
        />
      </Modal>

      <ConfirmModal
        isOpen={confirm.isOpen}
        onClose={confirm.close}
        onConfirm={handleDeleteShift}
        loading={ml}
        title="Delete Shift"
        message={`Delete shift "${confirm.data?.name}"? All seating assignments for this shift will also be deleted.`}
      />
    </div>
  )
}