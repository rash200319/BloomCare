"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface StoredProfile {
  id?: string
  role?: string
  full_name?: string
  email?: string
  national_id?: string
  phone_number?: string
  contact_number?: string
  emergency_contact?: string
}

interface ProfileSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userProfile: StoredProfile | null
  onProfileSaved?: (profile: StoredProfile) => void
}

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "")

function getApiBaseCandidates(): string[] {
  const candidates = [configuredApiBase, "http://localhost:8005/api/v1", "http://127.0.0.1:8005/api/v1"]

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol || "http:"
    const host = window.location.hostname || "localhost"
    candidates.push(`${protocol}//${host}:8005/api/v1`)
  }

  candidates.push("http://localhost:8005/api/v1", "http://127.0.0.1:8005/api/v1")

  return candidates.filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value as string) === index)
}

function normalizeRole(role: string | undefined): string {
  return String(role || "").toUpperCase()
}

export default function ProfileSettingsDialog({
  open,
  onOpenChange,
  userProfile,
  onProfileSaved,
}: ProfileSettingsDialogProps) {
  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [emergencyContact, setEmergencyContact] = useState("")
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const roleName = useMemo(() => normalizeRole(userProfile?.role), [userProfile?.role])
  const isPatient = roleName === "PATIENT"

  useEffect(() => {
    if (!open) return

    setFullName(userProfile?.full_name || "")
    setPhoneNumber(userProfile?.phone_number || "")
    setContactNumber(userProfile?.contact_number || "")
    setEmergencyContact(userProfile?.emergency_contact || "")
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setErrorMessage("")
    setSuccessMessage("")
  }, [open, userProfile])

  const parseErrorDetail = async (response: Response): Promise<string> => {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    if (typeof detail === "string" && detail.trim()) return detail
    if (Array.isArray(detail)) {
      const joined = detail
        .map((item: { loc?: Array<string | number>; msg?: string }) => `${item?.loc ? item.loc.join(".") : "field"}: ${item?.msg || "invalid"}`)
        .join("; ")
      if (joined) return joined
    }
    return `Request failed with status ${response.status}`
  }

  const apiRequest = async (path: string, init?: RequestInit): Promise<Response> => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("bloomcare_access_token") : null
    if (!token) {
      throw new Error("No active session found. Please login again.")
    }

    const headers = new Headers(init?.headers)
    headers.set("Authorization", `Bearer ${token}`)
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }

    const candidates = getApiBaseCandidates()
    let lastError: unknown = null
    let lastNotFoundResponse: Response | null = null

    for (const base of candidates) {
      try {
        const response = await fetch(`${base}${path}`, {
          ...init,
          headers,
        })

        if (response.status === 404) {
          lastNotFoundResponse = response
          continue
        }

        return response
      } catch (error) {
        lastError = error
      }
    }

    if (lastNotFoundResponse) {
      return lastNotFoundResponse
    }

    if (lastError instanceof Error) {
      throw new Error(`Unable to reach backend API. ${lastError.message}`)
    }

    throw new Error("Unable to reach backend API.")
  }

  const handleSave = async () => {
    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setErrorMessage("Full name is required")
      return
    }

    const isPasswordChangeRequested = !isPatient && (oldPassword || newPassword || confirmPassword)
    if (isPasswordChangeRequested) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        setErrorMessage("To change password, provide current password, new password, and confirm password")
        return
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage("New password and confirm password do not match")
        return
      }
    }

    setIsSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const profilePayload = isPatient
        ? {
            full_name: trimmedName,
            contact_number: contactNumber.trim() || null,
            emergency_contact: emergencyContact.trim() || null,
          }
        : {
            full_name: trimmedName,
            phone_number: phoneNumber.trim() || null,
          }

      const profileResponse = await apiRequest("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(profilePayload),
      })

      if (!profileResponse.ok) {
        throw new Error(await parseErrorDetail(profileResponse))
      }

      const updatedProfile = (await profileResponse.json()) as StoredProfile

      if (isPasswordChangeRequested) {
        const passwordResponse = await apiRequest("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            old_password: oldPassword,
            new_password: newPassword,
          }),
        })

        if (!passwordResponse.ok) {
          throw new Error(await parseErrorDetail(passwordResponse))
        }
      }

      const storedRaw = typeof window !== "undefined" ? window.localStorage.getItem("bloomcare_user_profile") : null
      let mergedProfile: StoredProfile = { ...updatedProfile }

      if (storedRaw) {
        const existing = JSON.parse(storedRaw) as StoredProfile
        mergedProfile = {
          ...existing,
          ...updatedProfile,
          full_name: updatedProfile.full_name || existing.full_name,
          role: existing.role || updatedProfile.role,
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("bloomcare_user_profile", JSON.stringify(mergedProfile))
      }

      onProfileSaved?.(mergedProfile)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccessMessage(isPasswordChangeRequested ? "Profile and password updated" : "Profile updated")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-full-name">Full Name</Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
            />
          </div>

          {isPatient ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="profile-contact-number">Contact Number</Label>
                <Input
                  id="profile-contact-number"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  placeholder="07XXXXXXXX or +94XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-emergency-contact">Emergency Contact</Label>
                <Input
                  id="profile-emergency-contact"
                  value={emergencyContact}
                  onChange={(event) => setEmergencyContact(event.target.value)}
                  placeholder="07XXXXXXXX or +94XXXXXXXXX"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="profile-phone-number">Phone Number</Label>
                <Input
                  id="profile-phone-number"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="07XXXXXXXX or +94XXXXXXXXX"
                />
              </div>
              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-600">Change Password</p>
                <div className="space-y-2">
                  <Label htmlFor="profile-old-password">Current Password</Label>
                  <Input
                    id="profile-old-password"
                    type="password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-new-password">New Password</Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-confirm-password">Confirm New Password</Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
