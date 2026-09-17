import { useState } from 'react'
import { Plus, Pencil, Trash2, Upload, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useFetch, useMutation, useModal, useDebounce, usePagination, useDownload } from '../../hooks'
import { studentsAPI, classesAPI, sectionsAPI } from '../../api'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select } from '../../components/ui/Input'
import { ConfirmModal, Pagination, CSVUpload } from '../../components/shared/index.jsx'

export default function Students() {
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [csvOpen, setCsvOpen] = useState(false)
  const { page, limit, setPage } = usePagination()
  const debouncedSearch = useDebounce(search)
  const modal = useModal()
  const confirm = useModal()
  const { mutate, loading: ml } = useMutation()
  const { download } = useDownload()

  const { data: classes } = useFetch(() => classesAPI.list({ limit: 100 }))
  const { data: sections } = useFetch(() => sectionsAPI.list({ limit: 300, class: filterClass || undefined }), [filterClass])

  const {
    data: students,
    loading,
    refetch,
  } = useFetch(
    () => studentsAPI.list({ page, limit, search: debouncedSearch || undefined, class: filterClass || undefined, section: filterSection || undefined }),
    [page, debouncedSearch, filterClass, filterSection]
  )

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm()

  // ✅ Watch the modal form's own "class" field
  const selectedFormClass = watch('class')

  // ✅ Separate fetch, scoped to whatever class is picked inside the modal
  const { data: formSections } = useFetch(
    () => sectionsAPI.list({ limit: 300, class: selectedFormClass || undefined }),
    [selectedFormClass]
  )

  const openAdd = () => { reset({}); modal.open(null) }
  const openEdit = (row) => {
    reset({ ...row, class: row.classId || row.class?.id, section: row.sectionId || row.section?.id })
    modal.open(row)
  }

  const onSubmit = (data) => {
    const fn = modal.data?.id
      ? () => studentsAPI.update(modal.data.id, data)
      : () => studentsAPI.create(data)
    mutate(fn, {
      successMsg: modal.data?.id ? 'Student updated' : 'Student added',
      onSuccess: () => { modal.close(); refetch() },
    })
  }

  const onDelete = () => {
    mutate(() => studentsAPI.delete(confirm.data.id), {
      successMsg: 'Student deactivated',
      onSuccess: () => { confirm.close(); refetch() },
    })
  }

  const handleCSVUpload = async (file) => {
    const res = await studentsAPI.uploadCSV(file)
    refetch()
    return res
  }

  const handleTemplate = () => {
    download(() => studentsAPI.downloadTemplate(), 'students_template.csv')
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'enrollmentNo', label: 'Enrollment No', render: (r) => <span className="font-mono text-xs">{r.enrollmentNo}</span> },
    { key: 'class', label: 'Class', render: (r) => r.class?.name || '—' },
    { key: 'section', label: 'Section', render: (r) => r.section?.name || '—' },
    { key: 'parentName', label: 'Parent', render: (r) => r.parentName || '—' },
    {
      key: 'actions', label: '', width: 90,
      render: (r) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Pencil size={13} /></button>
          <button onClick={() => confirm.open(r)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Upload} size="sm" onClick={() => setCsvOpen(true)}>Import CSV</Button>
          <Button icon={Plus} size="sm" onClick={openAdd}>Add Student</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, enrollment, parent email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select className="min-w-36" value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setFilterSection(''); setPage(1) }}>
          <option value="">All Classes</option>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select className="min-w-36" value={filterSection} onChange={(e) => { setFilterSection(e.target.value); setPage(1) }}>
          <option value="">All Sections</option>
          {sections?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <div className="card">
        <Table columns={columns} data={students} loading={loading} emptyMessage="No students found" />
        <Pagination page={page} totalPages={Math.ceil((students?.length || 0) / limit)} onPage={setPage} />
      </div>

      {/* CSV Modal */}
      <Modal isOpen={csvOpen} onClose={() => setCsvOpen(false)} title="Import Students via CSV" size="md">
        <CSVUpload onUpload={handleCSVUpload} onDownloadTemplate={handleTemplate} loading={ml} />
      </Modal>

      {/* Add/Edit Modal */}
      <Modal isOpen={modal.isOpen} onClose={modal.close} title={modal.data?.id ? 'Edit Student' : 'Add Student'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Full Name" required error={errors.name?.message} {...register('name', { required: 'Required' })} />
          </div>
          <Input label="Enrollment No" required error={errors.enrollmentNo?.message} {...register('enrollmentNo', { required: 'Required' })} />
          <Select label="Class" required error={errors.class?.message} {...register('class', { required: 'Required' })}>
            <option value="">Select…</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select
            label="Section"
            required
            error={errors.section?.message}
            disabled={!selectedFormClass}
            {...register('section', { required: 'Required' })}
          >
            <option value="">{selectedFormClass ? 'Select…' : 'Select a class first'}</option>
            {formSections?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input label="Parent Name" {...register('parentName')} />
          <Input label="Parent Email" type="email" {...register('parentEmail')} />
          <div className="col-span-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={modal.close}>Cancel</Button>
            <Button type="submit" loading={ml}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal isOpen={confirm.isOpen} onClose={confirm.close} onConfirm={onDelete} loading={ml} title="Deactivate Student" message={`Deactivate "${confirm.data?.name}"? They won't appear in future exam assignments.`} confirmLabel="Deactivate" />
    </div>
  )
}