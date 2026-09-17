import api from './axios'

// ── AUTH ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/admin/auth/login', data),
  logout: () => api.post('/admin/auth/logout'),
  me: () => api.get('/admin/auth/me'),
}

// ── DASHBOARD ───────────────────────────────────────────────────────────────
export const dashboardAPI = {
  get: () => api.get('/admin/dashboard'),
}

// ── ACADEMIC ─────────────────────────────────────────────────────────────────
export const classesAPI = {
  list: (params) => api.get('/admin/academic/classes', { params }),
  create: (data) => api.post('/admin/academic/classes', data),
  createWithSections: (data) => api.post('/admin/academic/classes-with-sections', data),
  update: (id, data) => api.put(`/admin/academic/classes/${id}`, data),
  delete: (id) => api.delete(`/admin/academic/classes/${id}`),
}

export const sectionsAPI = {
  list: (params) => api.get('/admin/academic/sections', { params }),
  create: (data) => api.post('/admin/academic/sections', data),
  update: (id, data) => api.put(`/admin/academic/sections/${id}`, data),
  delete: (id) => api.delete(`/admin/academic/sections/${id}`),
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────
export const studentsAPI = {
  list: (params) => api.get('/admin/students', { params }),
  create: (data) => api.post('/admin/students', data),
  update: (id, data) => api.put(`/admin/students/${id}`, data),
  delete: (id) => api.delete(`/admin/students/${id}`),
  uploadCSV: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/admin/students/csv/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  downloadTemplate: () => api.get('/admin/students/csv/template', { responseType: 'blob' }),
}

// ── FACULTY ──────────────────────────────────────────────────────────────────
export const facultyAPI = {
  list: (params) => api.get('/admin/faculty', { params }),
  create: (data) => api.post('/admin/faculty', data),
  update: (id, data) => api.put(`/admin/faculty/${id}`, data),
  delete: (id) => api.delete(`/admin/faculty/${id}`),
}

// ── ROOMS ────────────────────────────────────────────────────────────────────
export const roomsAPI = {
  list: (params) => api.get('/admin/rooms', { params }),
  getById: (id) => api.get(`/admin/rooms/${id}`),
  create: (data) => api.post('/admin/rooms', data),
  update: (id, data) => api.put(`/admin/rooms/${id}`, data),
  updateSeats: (id, seats) => api.put(`/admin/rooms/${id}/seats`, { seats }),
  delete: (id) => api.delete(`/admin/rooms/${id}`),
}

// ── EXAMS ────────────────────────────────────────────────────────────────────
export const examsAPI = {
  list: (params) => api.get('/admin/exams', { params }),
  create: (data) => api.post('/admin/exams', data),
  update: (id, data) => api.put(`/admin/exams/${id}`, data),
  delete: (id) => api.delete(`/admin/exams/${id}`),
}

// ── SHIFTS ───────────────────────────────────────────────────────────────────
export const shiftsAPI = {
  list: (examId) => api.get(`/admin/exams/${examId}/shifts`),
  create: (examId, data) => api.post(`/admin/exams/${examId}/shifts`, data),
  update: (examId, shiftId, data) => api.put(`/admin/exams/${examId}/shifts/${shiftId}`, data),
  delete: (examId, shiftId) => api.delete(`/admin/exams/${examId}/shifts/${shiftId}`),
  resolveStudents: (examId, shiftId) => api.post(`/admin/exams/${examId}/shifts/${shiftId}/resolve-students`),
}

// ── INVIGILATORS ─────────────────────────────────────────────────────────────
export const invigilatorsAPI = {
  list: (examId, shiftId) => api.get(`/admin/exams/${examId}/shifts/${shiftId}/invigilators`),
  assign: (examId, shiftId, data) => api.post(`/admin/exams/${examId}/shifts/${shiftId}/invigilators`, data),
  remove: (examId, shiftId, id) => api.delete(`/admin/exams/${examId}/shifts/${shiftId}/invigilators/${id}`),
}

// ── SEATING ──────────────────────────────────────────────────────────────────
export const seatingAPI = {
  generate: (examId, shiftId) => api.post(`/admin/exams/${examId}/shifts/${shiftId}/seating/generate`),
  preview: (examId, shiftId) => api.get(`/admin/exams/${examId}/shifts/${shiftId}/seating/preview`),
  swap: (examId, shiftId, data) => api.put(`/admin/exams/${examId}/shifts/${shiftId}/seating/swap`, data),
  manualAssign: (examId, shiftId, data) => api.put(`/admin/exams/${examId}/shifts/${shiftId}/seating/manual`, data),
  reset: (examId, shiftId) => api.delete(`/admin/exams/${examId}/shifts/${shiftId}/seating/reset`),
  publish: (examId, shiftId) => api.post(`/admin/exams/${examId}/shifts/${shiftId}/seating/publish`),
  unpublish: (examId, shiftId) => api.delete(`/admin/exams/${examId}/shifts/${shiftId}/seating/unpublish`),
}

// ── PDF ──────────────────────────────────────────────────────────────────────
export const pdfAPI = {
  // Room seating charts
  roomPDF: (examId, shiftId, roomId) =>
    api.get(`/admin/exams/${examId}/shifts/${shiftId}/pdf/room/${roomId}`, { responseType: 'blob' }),
  allRoomsPDF: (examId, shiftId) =>
    api.get(`/admin/exams/${examId}/shifts/${shiftId}/pdf/rooms/all`, { responseType: 'blob' }),
  facultyDutyPDF: (examId) =>
    api.get(`/admin/exams/${examId}/pdf/faculty-duty`, { responseType: 'blob' }),

  // Room charts — all rooms merged single PDF
  allRoomsMergedPDF: (examId, shiftId) =>
    api.get(`/admin/exams/${examId}/shifts/${shiftId}/pdf/rooms/merged`, { responseType: 'blob' }),

  // Seat labels — single room
  roomLabelsPDF: (examId, shiftId, roomId, variant = 'detailed') =>
    api.get(`/admin/exams/${examId}/shifts/${shiftId}/pdf/room/${roomId}/labels`, {
      params: { variant },
      responseType: 'blob',
    }),

  // Seat labels — all rooms ZIP
  allRoomsLabelsPDF: (examId, shiftId, variant = 'detailed') =>
    api.get(`/admin/exams/${examId}/shifts/${shiftId}/pdf/rooms/labels`, {
      params: { variant },
      responseType: 'blob',
    }),

  // Seat labels — all rooms merged single PDF
  allRoomsLabelsMergedPDF: (examId, shiftId, variant = 'detailed') =>
    api.get(`/admin/exams/${examId}/shifts/${shiftId}/pdf/rooms/labels/merged`, {
      params: { variant },
      responseType: 'blob',
    }),
}

// ── SUPER ADMIN ───────────────────────────────────────────────────────────────
export const superadminAPI = {
  login: (data) => api.post('/superadmin/auth/login', data),
  logout: () => api.post('/superadmin/auth/logout'),
  stats: () => api.get('/superadmin/stats'),

  listSchools: (params) => api.get('/superadmin/schools', { params }),
  getSchool: (id) => api.get(`/superadmin/schools/${id}`),
  createSchool: (data) => api.post('/superadmin/schools', data),
  renewSchool: (id, data) => api.post(`/superadmin/schools/${id}/renew`, data),
  resetPassword: (id, data) => api.post(`/superadmin/schools/${id}/reset-password`, data),
  suspendSchool: (id) => api.post(`/superadmin/schools/${id}/suspend`),
  terminateSchool: (id) => api.post(`/superadmin/schools/${id}/terminate`),
  reactivateSchool: (id) => api.post(`/superadmin/schools/${id}/reactivate`),
  generatePassword: () => api.get('/superadmin/generate-password'),
}

// ── PUBLIC LOOKUP ─────────────────────────────────────────────────────────────
// ── PUBLIC LOOKUP ─────────────────────────────────────────────────────────────
export const lookupAPI = {
  student: (schoolCode, enrollmentNo) =>
    api.get(`/public/student/${schoolCode}/${enrollmentNo}`),
  faculty: (schoolCode, email) =>
    api.get(`/public/faculty/${schoolCode}/${encodeURIComponent(email)}`),
}