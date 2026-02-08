import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {

  // champs formulaire
  user: User = {
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    poste: '',
    departement: '',
    region: '',
    telephone: '',
    role: 'MANAGER',
    photoProfil: ''
  };

  confirmPassword = '';

  // UI state
  loading = false;
  errorMsg = '';
  successMsg = '';

  // optionnel: preview photo
  photoPreview: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // petit check type
    if (!file.type.startsWith('image/')) {
      this.errorMsg = 'Veuillez sélectionner une image.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result);
      this.user.photoProfil = base64;
      this.photoPreview = base64;
    };
    reader.readAsDataURL(file);
  }

  // ✅ NOUVELLE MÉTHODE - Ajoutez ceci
  removePhoto(): void {
    this.photoPreview = null;
    this.user.photoProfil = '';
    // Reset l'input file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  private validate(): string | null {
    this.errorMsg = '';
    this.successMsg = '';

    // Obligatoires
    if (!this.user.nom.trim()) return 'Le nom est obligatoire.';
    if (!this.user.prenom.trim()) return 'Le prénom est obligatoire.';
    if (!this.user.email.trim()) return "L'email est obligatoire.";
    if (!this.user.poste.trim()) return 'Le poste est obligatoire.';
    if (!this.user.departement.trim()) return 'Le département est obligatoire.';

    // Mot de passe
    if (!this.user.motDePasse || this.user.motDePasse.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (this.user.motDePasse !== this.confirmPassword) {
      return 'Les mots de passe ne correspondent pas.';
    }

    // Téléphone (optionnel) simple check
    if (this.user.telephone && this.user.telephone.length < 6) {
      return 'Numéro de téléphone invalide.';
    }

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
    this.successMsg = '';

    // Normaliser email côté front
    this.user.email = this.user.email.trim().toLowerCase();

    this.auth.register(this.user).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Compte créé avec succès. Redirection vers la connexion...';

        // redirection après 1s
        setTimeout(() => this.router.navigate(['/login']), 900);
      },
      error: (e: Error) => {
        this.loading = false;
        this.errorMsg = e.message || "Erreur lors de l'inscription.";
      }
    });
  }
  
}