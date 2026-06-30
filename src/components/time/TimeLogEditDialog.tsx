'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { adminCorrectTimeLog } from '@/lib/actions/time'
import { useToast } from '@/lib/store/toast'
import type { TimeLog } from '@/lib/types'

// Convert ISO string → datetime-local value (YYYY-MM-DDTHH:MM) in local time
function toLocalDT(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

const schema = z.object({
  clock_in_at:  z.string().min(1, 'Required'),
  clock_out_at: z.string().min(1, 'Required'),
})
type FormValues = z.infer<typeof schema>

interface Props {
  open:    boolean
  log:     TimeLog | null
  onClose: () => void
  onSaved: (updated: TimeLog) => void
}

export function TimeLogEditDialog({ open, log, onClose, onSaved }: Props) {
  const toast = useToast()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (log) {
      reset({
        clock_in_at:  toLocalDT(log.clock_in_at),
        clock_out_at: log.clock_out_at ? toLocalDT(log.clock_out_at) : '',
      })
    }
  }, [log, reset])

  const onSubmit = async (values: FormValues) => {
    if (!log) return
    const res = await adminCorrectTimeLog(log.id, {
      clock_in_at:  new Date(values.clock_in_at).toISOString(),
      clock_out_at: new Date(values.clock_out_at).toISOString(),
    })
    if (res.error) { setError('root', { message: res.error }); return }
    onSaved(res.data as TimeLog)
    toast.success('Time log corrected')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Correct time log"
      description="Changes are logged with closed_reason = admin_correction."
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {errors.root && (
          <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </div>
        )}

        <Input
          label="Clock-in time"
          type="datetime-local"
          error={errors.clock_in_at?.message}
          {...register('clock_in_at')}
        />

        <Input
          label="Clock-out time"
          type="datetime-local"
          error={errors.clock_out_at?.message}
          {...register('clock_out_at')}
        />

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save correction
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
