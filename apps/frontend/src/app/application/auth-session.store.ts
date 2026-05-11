import { Injectable, signal } from '@angular/core';
import type { UserProfile } from '@edo/types';

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  private readonly currentUserSignal = signal<UserProfile | null>(null);

  public readonly currentUser = this.currentUserSignal.asReadonly();

  public setCurrentUser(user: UserProfile): void {
    this.currentUserSignal.set(user);
  }

  public clear(): void {
    this.currentUserSignal.set(null);
  }
}
