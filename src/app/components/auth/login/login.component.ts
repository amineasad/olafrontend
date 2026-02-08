import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  email = '';
  password = '';

  loading = false;
  errorMsg = '';

  constructor(private auth: AuthService, private router: Router) {}

  private validate(): string | null {
    this.errorMsg = '';

    if (!this.email.trim()) return "L'email est obligatoire.";
    if (!this.password) return "Le mot de passe est obligatoire.";

    // check email simple
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
    if (!ok) return "Format d'email invalide.";

    return null;
  }

  onSubmit() {
    const err = this.validate();
    if (err) {
      this.errorMsg = err;
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    const email = this.email.trim().toLowerCase();

    this.auth.login(email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/accueil']); // change vers ton dashboard si tu veux
      },
      error: (e: any) => {
        this.loading = false;

        // msg clean (backend)
        const msg =
          e?.error?.message ||
          e?.error?.error ||
          e?.message ||
          'Email ou mot de passe incorrect.';

        this.errorMsg = msg;
      }
    });
  }
}
