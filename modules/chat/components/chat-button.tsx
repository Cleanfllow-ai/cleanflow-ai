'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
// import { ChatDrawer } from './chat-drawer'
import { motion, AnimatePresence } from 'framer-motion'

export function ChatButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              <MessageCircle className="h-6 w-6" />
              <span className="sr-only">Open Help Chat</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* <ChatDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} /> */}
    </>
  )
}
