import { useState, useEffect } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])

    if (duration) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, addToast, removeToast }
}

export function Toast({ id, message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  }[type] || 'bg-blue-500'

  return (
    <div className={`${bgColor} text-white p-4 rounded shadow-lg animate-fade-in`}>
      <div className="flex justify-between items-center">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="ml-4 font-bold hover:opacity-75"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onClose(toast.id)}
        />
      ))}
    </div>
  )
}
