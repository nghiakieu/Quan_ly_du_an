"use client";

import { useEffect, useState } from 'react';
import { getProjectMembers, addProjectMember, updateProjectMemberRole, removeProjectMember, getUsers, type ProjectMember, type UserInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Shield, Eye, Edit3 } from 'lucide-react';

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    manager: { label: 'Quản lý', icon: Shield, color: 'bg-blue-100 text-blue-700' },
    editor: { label: 'Biên tập', icon: Edit3, color: 'bg-green-100 text-green-700' },
    viewer: { label: 'Xem', icon: Eye, color: 'bg-gray-100 text-gray-600' },
};

export default function ProjectMembers({ projectId }: { projectId: number | string }) {
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [selectedRole, setSelectedRole] = useState('viewer');
    const [loading, setLoading] = useState(true);
    const { isAuthenticated, user } = useAuth();

    const canManage = isAuthenticated && user && (user.role === 'admin' || user.role === 'editor');

    useEffect(() => {
        fetchMembers();
    }, [projectId]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const data = await getProjectMembers(projectId);
            setMembers(data);
        } catch {
            // Silently fail if not authorized
        } finally {
            setLoading(false);
        }
    };

    const handleShowAddForm = async () => {
        try {
            const users = await getUsers();
            // Filter out users who are already members
            const memberUserIds = new Set(members.map(m => m.user_id));
            setAllUsers(users.filter(u => !memberUserIds.has(u.id)));
            setShowAddForm(true);
        } catch {
            toast.error("Không thể tải danh sách người dùng");
        }
    };

    const handleAddMember = async () => {
        if (!selectedUserId) return;
        try {
            await addProjectMember(projectId, {
                user_id: Number(selectedUserId),
                role: selectedRole,
            });
            toast.success("Đã thêm thành viên!");
            setShowAddForm(false);
            setSelectedUserId('');
            setSelectedRole('viewer');
            fetchMembers();
        } catch (err: any) {
            toast.error(err?.response?.data?.detail || "Không thể thêm thành viên");
        }
    };

    const handleRoleChange = async (memberId: number, newRole: string) => {
        try {
            await updateProjectMemberRole(projectId, memberId, newRole);
            toast.success("Đã cập nhật quyền!");
            fetchMembers();
        } catch {
            toast.error("Không thể cập nhật quyền");
        }
    };

    const handleRemove = async (memberId: number, username: string) => {
        if (!confirm(`Xóa "${username}" khỏi dự án?`)) return;
        try {
            await removeProjectMember(projectId, memberId);
            toast.success("Đã xóa thành viên!");
            fetchMembers();
        } catch {
            toast.error("Không thể xóa thành viên");
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 text-gray-400">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Đang tải thành viên...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                        Thành viên dự án ({members.length})
                    </h3>
                </div>
                {canManage && !showAddForm && (
                    <button
                        onClick={handleShowAddForm}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        Thêm
                    </button>
                )}
            </div>

            {/* Add Member Form */}
            {showAddForm && (
                <div className="p-4 bg-blue-50/50 border-b border-blue-100">
                    <div className="flex gap-2 items-end flex-wrap">
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-xs text-gray-500 mb-1">Người dùng</label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                                className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">-- Chọn --</option>
                                {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-gray-500 mb-1">Quyền</label>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="viewer">Xem</option>
                                <option value="editor">Biên tập</option>
                                <option value="manager">Quản lý</option>
                            </select>
                        </div>
                        <button
                            onClick={handleAddMember}
                            disabled={!selectedUserId}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            Thêm
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                    {allUsers.length === 0 && (
                        <p className="text-xs text-gray-400 mt-2">Tất cả người dùng đã là thành viên dự án</p>
                    )}
                </div>
            )}

            {/* Members List */}
            <div className="divide-y divide-gray-50">
                {members.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                        Chưa có thành viên nào
                    </div>
                ) : (
                    members.map((member) => {
                        const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
                        const RoleIcon = roleConfig.icon;
                        return (
                            <div key={member.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                        {member.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{member.username}</p>
                                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${roleConfig.color}`}>
                                            <RoleIcon className="h-3 w-3" />
                                            {roleConfig.label}
                                        </span>
                                    </div>
                                </div>

                                {canManage && (
                                    <div className="flex items-center gap-1">
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="viewer">Xem</option>
                                            <option value="editor">Biên tập</option>
                                            <option value="manager">Quản lý</option>
                                        </select>
                                        <button
                                            onClick={() => handleRemove(member.id, member.username)}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            title="Xóa thành viên"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
