"use client"

import { getApiBaseCandidates } from "@/lib/api"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  AlertCircle,
  Bell,
  Trash2,
  Clock,
  X,
  Filter,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  appointment_id: string
  notification_type:
    | "BOOKING_REQUESTED"
    | "BOOKING_CONFIRMATION_REQUIRED"
    | "APPOINTMENT_CONFIRMED"
    | "APPOINTMENT_CANCELLED"
    | "APPOINTMENT_COMPLETED"
    | "APPOINTMENT_REMINDER"
    | "BOOKING_FAILED"
    | "ESCALATION_ALERT"
  title: string
  message: string
  is_read: boolean
  read_at: string | null
  related_data: {
    patient_name?: string
    specialist_name?: string
    appointment_date?: string
    cancellation_reason?: string
  }
  created_at: string
}

interface NotificationPanelProps {
  patientId?: string
}

export default function NotificationPanel({ patientId }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<"ALL" | "CONFIRMED" | "CANCELLED" | "COMPLETED">("ALL")
  const [filterReadStatus, setFilterReadStatus] = useState<"ALL" | "READ" | "UNREAD">("ALL")
  const mountedRef = useRef(true)

  // Fetch notifications with retry logic
  const loadNotifications = async () => {
    if (!mountedRef.current) return

    try {
      setIsLoading(true)
      setError(null)

      const token = typeof window !== "undefined" ? localStorage.getItem("bloomcare_access_token") : null
      if (!token) {
        setError("Authentication required")
        setIsLoading(false)
        return
      }

      const candidates = getApiBaseCandidates()

      let lastError: unknown = null
      let response: Response | null = null

      for (const base of candidates) {
        try {
          const url = `${base}/notifications/?limit=100`
          response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          if (response.status === 404) {
            continue
          }
          break
        } catch (err) {
          lastError = err
          continue
        }
      }

      if (!response || !response.ok) {
        throw lastError || new Error("Failed to fetch notifications")
      }

      const data = await response.json()
      if (mountedRef.current) {
        const notificationsList = data.notifications || []
        console.log("Fetched notifications:", notificationsList)
        setNotifications(notificationsList)
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error("Notifications error:", err)
        setError(err instanceof Error ? err.message : "Failed to load notifications")
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true
    loadNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  // Apply filters
  useEffect(() => {
    let filtered = notifications
    console.log(`Processing ${filtered.length} notifications with filterType=${filterType}, filterReadStatus=${filterReadStatus}`)

    // Filter by type
    if (filterType === "CONFIRMED") {
      filtered = filtered.filter((n) => n.notification_type === "APPOINTMENT_CONFIRMED")
    } else if (filterType === "CANCELLED") {
      filtered = filtered.filter((n) => n.notification_type === "APPOINTMENT_CANCELLED")
    } else if (filterType === "COMPLETED") {
      filtered = filtered.filter((n) => n.notification_type === "APPOINTMENT_COMPLETED")
    }

    console.log(`After type filter: ${filtered.length} notifications`)

    // Filter by read status
    if (filterReadStatus === "READ") {
      filtered = filtered.filter((n) => n.is_read)
    } else if (filterReadStatus === "UNREAD") {
      filtered = filtered.filter((n) => !n.is_read)
    }

    console.log(`After read status filter: ${filtered.length} notifications`)

    // Sort by newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log(`Final filtered: ${filtered.length} notifications`)
    setFilteredNotifications(filtered)
  }, [notifications, filterType, filterReadStatus])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("bloomcare_access_token") : null
      if (!token) return

      const candidates = getApiBaseCandidates()

      for (const base of candidates) {
        try {
          await fetch(`${base}/notifications/${notificationId}/read`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          break
        } catch (err) {
          continue
        }
      }

      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        )
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("bloomcare_access_token") : null
      if (!token) return

      const candidates = getApiBaseCandidates()

      for (const base of candidates) {
        try {
          await fetch(`${base}/notifications/read-all`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          break
        } catch (err) {
          continue
        }
      }

      if (mountedRef.current) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err)
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("bloomcare_access_token") : null
      if (!token) return

      const candidates = getApiBaseCandidates()

      for (const base of candidates) {
        try {
          await fetch(`${base}/notifications/${notificationId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          break
        } catch (err) {
          continue
        }
      }

      if (mountedRef.current) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      }
    } catch (err) {
      console.error("Failed to delete notification:", err)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl">Notifications</CardTitle>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Mark All Read
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <div className="space-y-3">
        {/* Notification Type Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="text-xs font-semibold text-gray-600 w-full">By Type:</div>
          <Button
            variant={filterType === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("ALL")}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            All
          </Button>
          <Button
            variant={filterType === "CONFIRMED" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("CONFIRMED")}
            className="flex items-center gap-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
          >
            <CheckCircle className="w-4 h-4" />
            Confirmed
          </Button>
          <Button
            variant={filterType === "CANCELLED" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("CANCELLED")}
            className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
          >
            <AlertCircle className="w-4 h-4" />
            Cancelled
          </Button>
          <Button
            variant={filterType === "COMPLETED" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("COMPLETED")}
            className="flex items-center gap-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
          >
            <CheckCircle className="w-4 h-4" />
            Completed
          </Button>
        </div>

        {/* Read Status Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="text-xs font-semibold text-gray-600 w-full">By Status:</div>
          <Button
            variant={filterReadStatus === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterReadStatus("ALL")}
            className="flex items-center gap-2"
          >
            All
          </Button>
          <Button
            variant={filterReadStatus === "READ" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterReadStatus("READ")}
            className="flex items-center gap-2"
          >
            Read
          </Button>
          <Button
            variant={filterReadStatus === "UNREAD" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterReadStatus("UNREAD")}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            Unread
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      {!isLoading && filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Bell className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-center">
                No notifications yet
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                "transition-all hover:shadow-md",
                notification.notification_type === "APPOINTMENT_CONFIRMED" &&
                  "border-green-200 bg-green-50/50",
                (notification.notification_type === "APPOINTMENT_CANCELLED" ||
                  notification.notification_type === "BOOKING_FAILED") &&
                  "border-red-200 bg-red-50/50",
                notification.notification_type === "APPOINTMENT_COMPLETED" &&
                  "border-purple-200 bg-purple-50/50",
                !notification.is_read && "border-blue-300 bg-blue-50/30"
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {notification.notification_type === "APPOINTMENT_CONFIRMED" ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                    ) : notification.notification_type === "APPOINTMENT_CANCELLED" ||
                        notification.notification_type === "BOOKING_FAILED" ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                      </div>
                    ) : notification.notification_type === "APPOINTMENT_COMPLETED" ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                        <CheckCircle className="h-6 w-6 text-purple-600" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Bell className="h-6 w-6 text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3
                          className={cn(
                            "text-sm font-semibold",
                            notification.notification_type === "APPOINTMENT_CONFIRMED" &&
                              "text-green-900",
                            (notification.notification_type === "APPOINTMENT_CANCELLED" ||
                              notification.notification_type === "BOOKING_FAILED") &&
                              "text-red-900",
                            notification.notification_type === "APPOINTMENT_COMPLETED" &&
                              "text-purple-900"
                          )}
                        >
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <Badge variant="outline" className="mt-1 bg-blue-100 text-blue-800 border-blue-300">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p
                      className={cn(
                        "mt-2 text-sm line-clamp-2",
                        notification.notification_type === "APPOINTMENT_CONFIRMED" &&
                          "text-green-800",
                        (notification.notification_type === "APPOINTMENT_CANCELLED" ||
                          notification.notification_type === "BOOKING_FAILED") &&
                          "text-red-800",
                        notification.notification_type === "APPOINTMENT_COMPLETED" &&
                          "text-purple-800"
                      )}
                    >
                      {notification.message}
                    </p>

                    {/* Metadata */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(notification.created_at).toLocaleString()}
                      </div>
                      {notification.related_data?.appointment_date && (
                        <div className="flex items-center gap-1">
                          📅 {new Date(notification.related_data.appointment_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      {!notification.is_read && (
                        <Button
                          onClick={() => handleMarkAsRead(notification.id)}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          Mark as Read
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(notification.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
