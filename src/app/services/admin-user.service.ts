import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type Role = 'MANAGER' | 'ADMIN';

export interface AdminUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  poste: string;
  departement: string;
  region?: string;
  telephone?: string;
  photoProfil?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private apiUrl = `${environment.apiUrl}/api/admin/users`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.apiUrl);
  }

  updateUser(id: number, user: AdminUser): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.apiUrl}/${id}`, user);
  }

  updateRole(id: number, role: Role): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${id}/role`, { role });
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
