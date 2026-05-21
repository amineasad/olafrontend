import { Component, OnInit } from '@angular/core';
import { AdminUser, AdminUserService, Role } from 'src/app/services/admin-user.service';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {

  users: AdminUser[] = [];
  loading = false;
  errorMsg = '';
  successMsg = '';

  // ── Edit Modal ──
  showEditModal = false;
  editUser: AdminUser | null = null;

  constructor(private adminUserService: AdminUserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMsg = '';
    this.adminUserService.getAllUsers().subscribe({
      next: (data) => { this.users = data || []; this.loading = false; },
      error: () => { this.errorMsg = 'Erreur chargement utilisateurs'; this.loading = false; }
    });
  }

  changeRole(user: AdminUser, role: Role): void {
    if (!user.id) return;
    this.successMsg = ''; this.errorMsg = '';
    this.adminUserService.updateRole(user.id, role).subscribe({
      next: () => { this.successMsg = `Rôle mis à jour pour ${user.prenom} ${user.nom}`; },
      error: () => { this.errorMsg = 'Erreur mise à jour rôle'; }
    });
  }

  deleteUser(userId: number | undefined): void {
    if (!userId) return;
    const ok = confirm('Supprimer cet utilisateur ?');
    if (!ok) return;
    this.successMsg = ''; this.errorMsg = '';
    this.adminUserService.deleteUser(userId).subscribe({
      next: () => {
        this.successMsg = 'Utilisateur supprimé avec succès';
        this.users = this.users.filter(u => u.id !== userId);
      },
      error: () => { this.errorMsg = 'Erreur suppression'; }
    });
  }

  openEdit(user: AdminUser): void {
    this.editUser = { ...user };
    this.showEditModal = true;
    this.successMsg = ''; this.errorMsg = '';
  }

  closeEdit(): void {
    this.showEditModal = false;
    this.editUser = null;
  }

  saveEdit(): void {
    if (!this.editUser?.id) return;
    this.successMsg = ''; this.errorMsg = '';
    this.adminUserService.updateUser(this.editUser.id, this.editUser).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === updated.id);
        if (idx !== -1) this.users[idx] = updated;
        this.successMsg = `${updated.prenom} ${updated.nom} mis à jour avec succès`;
        this.closeEdit();
      },
      error: () => { this.errorMsg = 'Erreur lors de la mise à jour'; }
    });
  }
}