import axios from 'axios'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})


instance.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname
      const isSuperAdminArea = path.startsWith('/superadmin')
      const isOnLoginPage = path.startsWith('/login') || path.startsWith('/superadmin/login')

      if (!isOnLoginPage) {
        window.location.href = isSuperAdminArea ? '/superadmin/login' : '/login'
      }
    }

    if (
      error.response?.status === 409 &&
      error.response?.data?.message?.includes('No active academic session') &&
      !window.location.pathname.startsWith('/admin/sessions') &&
      !window.location.pathname.startsWith('/login')
    ) {
      window.location.href = '/admin/sessions'
    }

    return Promise.reject(error)
  }
)

export default instance