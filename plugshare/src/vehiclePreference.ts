function storageKey(userId: string): string {
  return `chargemitra:default-vehicle:${userId}`
}

export function getDefaultVehicleId(userId: string): string {
  return localStorage.getItem(storageKey(userId)) ?? ''
}

export function setDefaultVehicleId(userId: string, vehicleId: string): void {
  localStorage.setItem(storageKey(userId), vehicleId)
}

export function clearDefaultVehicleId(userId: string): void {
  localStorage.removeItem(storageKey(userId))
}
