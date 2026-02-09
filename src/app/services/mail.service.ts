import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface SendMailRequest {
  to: string;
  year?: string;
  dashboardUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class MailService {
  private baseUrl = `${environment.apiUrl}/api/mail`;

  constructor(private http: HttpClient) {}

  sendDashboardReady(payload: SendMailRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/send-dashboard-ready`, payload, { responseType: 'text' });
  }
}
