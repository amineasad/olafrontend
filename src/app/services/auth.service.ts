// src/app/services/auth.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';



export type Role = 'MANAGER' | 'ADMIN';

export interface User {
  id?: number;

  // Identité
  nom: string;
  prenom: string;
  email: string;

  // ⚠️ mot de passe en clair côté front (pour register/login uniquement)
  motDePasse?: string;

  // Profil Ola
  role?: Role; // optionnel: le backend peut mettre MANAGER par défaut
  poste: string;
  departement: string;
  region?: string;
  telephone?: string;

  // Photo (Base64 ou URL)
  photoProfil?: string;
}

// ✅ CHANGEMENT ICI : interface doit matcher le backend
export interface LoginRequest {
  email: string;
  motDePasse: string;  // ← Changé de "password" à "motDePasse"
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // ✅ Adapte selon ton backend (ex: /api/auth)
  private apiUrl = `${environment.apiUrl}/api/auth`;


  private storageKey = 'currentUser';

  constructor(private http: HttpClient) {}

  // ✅ Inscription
  register(user: User): Observable<User> {
    // Normaliser email
    const payload = {
      ...user,
      email: user.email?.trim().toLowerCase()
    };

    return this.http.post<User>(`${this.apiUrl}/register`, payload).pipe(
      tap((savedUser) => {
        // Optionnel: auto-login après register
        localStorage.setItem(this.storageKey, JSON.stringify(savedUser));
      }),
      catchError(this.handleError)
    );
  }

  // ✅ CHANGEMENT ICI : Connexion
  login(email: string, password: string): Observable<User> {
    const payload: LoginRequest = {
      email: email?.trim().toLowerCase(),
      motDePasse: password  // ← Changé de "password" à "motDePasse"
    };

    return this.http.post<User>(`${this.apiUrl}/login`, payload).pipe(
      tap((user) => {
        // Stocker l'utilisateur dans localStorage
        localStorage.setItem(this.storageKey, JSON.stringify(user));
      }),
      catchError(this.handleError)
    );
  }

  // ✅ Déconnexion
  logout(): void {
    localStorage.removeItem(this.storageKey);
  }

  // ✅ Vérifier si connecté
  isLoggedIn(): boolean {
    return localStorage.getItem(this.storageKey) !== null;
  }

  // ✅ Récupérer utilisateur courant
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(this.storageKey);
    return userStr ? (JSON.parse(userStr) as User) : null;
  }

 // ✅ NOUVEAU CODE (gère mieux les erreurs)
private handleError(error: HttpErrorResponse) {
  let message = 'Erreur serveur. Vérifie le backend.';

  if (error.error instanceof ErrorEvent) {
    // Erreur côté client
    message = `Erreur: ${error.error.message}`;
  } else {
    // Erreur côté serveur
    if (typeof error.error === 'string') {
      // Si le backend renvoie du texte brut
      message = error.error;
    } else if (error.error?.message) {
      // Si le backend renvoie un objet avec message
      message = error.error.message;
    } else if (error.status === 0) {
      // Pas de connexion au serveur
      message = 'Impossible de se connecter au serveur. Vérifie que le backend est démarré.';
    } else if (error.status === 401 || error.status === 403) {
      // Non autorisé
      message = 'Email ou mot de passe incorrect.';
    }
  }

  console.error('Erreur complète:', error); // Pour debug
  return throwError(() => new Error(message));
}
}