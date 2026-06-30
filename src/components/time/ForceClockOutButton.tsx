'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ForceClockOutDialog } from './ForceClockOutDialog'

interface Props {
  employeeId: string
  timeLogId:  string
  clockInAt:  string
}

export function ForceClockOutButton({ employeeId, timeLogId, clockInAt }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <LogOut className="h-3.5 w-3.5" />
        Force clock out
      </Button>

      <ForceClockOutDialog
        open={open}
        employeeId={employeeId}
        timeLogId={timeLogId}
        clockInAt={clockInAt}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
