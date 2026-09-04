import { useCallback, useState } from 'react'

type UseDialogOpenProps = {
  defaultOpen?: boolean
  renderCloseDelay?: number
}

export const useDialogOpen = <TFormValue>(props: UseDialogOpenProps = {}) => {
  const { defaultOpen = false, renderCloseDelay = 300 } = props
  const [open, setOpen] = useState(defaultOpen)
  const [formValue, setFormValue] = useState<TFormValue | undefined>()
  const [render, setRender] = useState(false)

  const onOpen = useCallback((value?: TFormValue) => {
    if (value) {
      setFormValue(value)
    } else {
      setFormValue(undefined)
    }
    setOpen(true)
    setRender(true)
  }, [])

  const onClose = useCallback(() => {
    setOpen(false)
    setTimeout(() => setRender(false), renderCloseDelay)
  }, [renderCloseDelay])

  const onOpenChange = useCallback(
    (val: boolean) => {
      setOpen(val)
      if (val === false) setTimeout(() => setRender(false), renderCloseDelay)
    },
    [renderCloseDelay]
  )

  return {
    open,
    formValue,
    render,
    onOpen,
    onClose,
    onOpenChange
  }
}
