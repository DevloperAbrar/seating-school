import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useFetch, useMutation, useModal } from '../../hooks'
import { classesAPI, sectionsAPI } from '../../api'
import Table from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Input, { Select } from '../../components/ui/Input'
import { ConfirmModal } from '../../components/shared/index.jsx'
import { Badge } from '../../components/ui/Loader'
// ── Generic CRUD table for each entity
function EntitySection({ title, columns, data, loading, onAdd, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <Button size="sm" icon={Plus} onClick={onAdd}>Add</Button>
      </div>
      <Table
        columns={[
          ...columns,
          {
            key: 'actions',
            label: '',
            width: 90,
            render: (row) => (
              <div className="flex gap-1">
                <button onClick={() => onEdit(row)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                  <Pencil size={13} />
                </button>
                <button onClick={() => onDelete(row)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              </div>
            ),
          },
        ]}
        data={data}
        loading={loading}
        emptyMessage={`No ${title.toLowerCase()} added yet`}
      />
    </div>
  )
}

// ── Classes section
function Classes({ classes, loading, onRefresh }) {
  const modal = useModal()
  const confirm = useModal()
  const { mutate, loading: ml } = useMutation()
  const { register, handleSubmit, reset, formState: { errors }, control, watch, setValue } = useForm({
    defaultValues: { name: '', order: '', sections: [''] }
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'sections' })

  const openAdd = () => {
    reset({ name: '', order: '', sections: [''] })
    modal.open(null)
  }

  const openEdit = (row) => {
    reset({ name: row.name, order: row.order, sections: [] })
    modal.open(row)
  }

  // Copy sections from the last class in the list
  const copyFromPrevious = () => {
    if (!classes?.length) return
    const prev = classes[classes.length - 1]
    const names = prev.sections?.length ? prev.sections.map(s => s.name) : ['']
    replace(names)
  }

  const onSubmit = (data) => {
    if (modal.data?.id) {
      // Edit mode — sections handled separately, just update class basics
      mutate(() => classesAPI.update(modal.data.id, { name: data.name, order: data.order }), {
        successMsg: 'Class updated',
        onSuccess: () => { modal.close(); onRefresh() },
      })
      return
    }

    const payload = {
      name: data.name,
      order: data.order,
      sections: (data.sections || []).map(s => s?.trim()).filter(Boolean),
    }
    mutate(() => classesAPI.createWithSections(payload), {
      successMsg: 'Class created',
      onSuccess: () => { modal.close(); onRefresh() },
    })
  }

  const onDelete = () => {
    mutate(() => classesAPI.delete(confirm.data.id), {
      successMsg: 'Class deleted',
      onSuccess: () => { confirm.close(); onRefresh() },
    })
  }

  return (
    <>
      <EntitySection
        title="Classes"
        data={classes}
        loading={loading}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(row) => confirm.open(row)}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'order', label: 'Order' },
          { key: 'sections', label: 'Sections', render: (r) => r.sections?.length ?? 0 },
          { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
        ]}
      />
      <Modal isOpen={modal.isOpen} onClose={modal.close} title={modal.data?.id ? 'Edit Class' : 'Add Class'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" required placeholder="e.g. Class 9" error={errors.name?.message} {...register('name', { required: 'Required' })} />
          <Input label="Order" type="number" placeholder="For sorting Class 1..12" error={errors.order?.message} {...register('order', { valueAsNumber: true })} />

          {!modal.data?.id && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Sections</label>
                {classes?.length > 0 && (
                  <button
                    type="button"
                    onClick={copyFromPrevious}
                    className="text-xs font-medium text-navy hover:underline"
                  >
                    Copy from previous class
                  </button>
                )}
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={`e.g. Section ${String.fromCharCode(65 + index)}`}
                    {...register(`sections.${index}`)}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => append('')}
                className="flex items-center gap-1 text-xs font-medium text-navy hover:underline"
              >
                <Plus size={12} /> Add another section
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={modal.close}>Cancel</Button>
            <Button type="submit" loading={ml}>Save</Button>
          </div>
        </form>
      </Modal>
      <ConfirmModal isOpen={confirm.isOpen} onClose={confirm.close} onConfirm={onDelete} loading={ml} title="Delete Class" message={`Delete class "${confirm.data?.name}"? This cannot be undone.`} />
    </>
  )
}

// ── Sections section
function Sections({ sections, classes, loading, onRefresh }) {
  const modal = useModal()
  const confirm = useModal()
  const { mutate, loading: ml } = useMutation()
  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const openAdd = () => { reset({}); modal.open(null) }
  const openEdit = (row) => { reset({ ...row, class: row.classId || row.class?.id || row.class }); modal.open(row) }

  const onSubmit = (data) => {
    const fn = modal.data?.id
      ? () => sectionsAPI.update(modal.data.id, data)
      : () => sectionsAPI.create(data)
    mutate(fn, {
      successMsg: modal.data?.id ? 'Section updated' : 'Section created',
      onSuccess: () => { modal.close(); onRefresh() },
    })
  }

  const onDelete = () => {
    mutate(() => sectionsAPI.delete(confirm.data.id), {
      successMsg: 'Section deleted',
      onSuccess: () => { confirm.close(); onRefresh() },
    })
  }

  return (
    <>
      <EntitySection
        title="Sections"
        data={sections}
        loading={loading}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(row) => confirm.open(row)}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'class', label: 'Class', render: (r) => r.class?.name || '—' },
          { key: 'isActive', label: 'Status', render: (r) => <Badge color={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
        ]}
      />
      <Modal isOpen={modal.isOpen} onClose={modal.close} title={modal.data?.id ? 'Edit Section' : 'Add Section'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" required placeholder="e.g. Commerce - A, Red House" error={errors.name?.message} {...register('name', { required: 'Required' })} />
          <Select label="Class" required error={errors.class?.message} {...register('class', { required: 'Required' })}>
            <option value="">Select class…</option>
            {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="flex justify-end gap-3"><Button variant="secondary" type="button" onClick={modal.close}>Cancel</Button><Button type="submit" loading={ml}>Save</Button></div>
        </form>
      </Modal>
      <ConfirmModal isOpen={confirm.isOpen} onClose={confirm.close} onConfirm={onDelete} loading={ml} title="Delete Section" message={`Delete section "${confirm.data?.name}"?`} />
    </>
  )
}

// ── Main page
export default function Academic() {
  const { data: classes, loading: cl, refetch: rClasses } = useFetch(() => classesAPI.list({ limit: 100 }))
  const { data: sections, loading: sl, refetch: rSections } = useFetch(() => sectionsAPI.list({ limit: 200 }))

  const refreshAll = () => {
    rClasses()
    rSections()
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Academic Structure</h1>
        <p className="text-sm text-gray-500">Manage classes and sections</p>
      </div>

      <Classes classes={classes} loading={cl} onRefresh={refreshAll} />
      <Sections sections={sections} classes={classes} loading={sl} onRefresh={rSections} />
    </div>
  )
}