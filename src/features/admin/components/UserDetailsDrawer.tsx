import { useState } from "react";
import {
    AlertCircle,
    Check,
    Edit,
    Loader2,
    Trash2,
} from "lucide-react";
import { adminUserService } from "../../../services/adminUserService";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import {
    getDisplayName,
    getDraftDisplayName,
    getPermissionGroupVariant,
    getUserEditFormState,
    PERMISSION_GROUP_OPTIONS,
} from "../data";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type {
    AdminUser,
    ProjectSummary,
    UpdateAdminUserRequest,
    UserEditFormState,
} from "../types";
import { AccessBadge } from "./Badges";
import { DetailRow } from "./DetailRow";
import { EditableDetailRow } from "./EditableDetailRow";
import { EditableSelectDetailRow } from "./EditableSelectDetailRow";
import { ProjectAccessPanel } from "./ProjectAccessPanel";
import { Section } from "./Section";
import { UserRolesPanel } from "./UserRolesPanel";
import { UserStatusSection } from "./UserStatusSection";

type UserDetailsDrawerProps = {
    user: AdminUser;
    availableProjects: ProjectSummary[];
    isOpen: boolean;
    onClose: () => void;
    onOpenProjectDetails: (projectId: string) => void;
    onUserUpdated: (updatedUser: AdminUser) => void;
    onRequestDelete: (user: AdminUser) => void;
};

type DraftUserState = {
    userId: string;
    draftUser: UserEditFormState;
};

type SaveErrorState = {
    userId: string;
    message: string;
};

export function UserDetailsDrawer({
                                      user,
                                      availableProjects,
                                      isOpen,
                                      onClose,
                                      onOpenProjectDetails,
                                      onUserUpdated,
                                      onRequestDelete,
                                  }: UserDetailsDrawerProps) {
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<SaveErrorState | null>(null);
    const [draftUserState, setDraftUserState] = useState<DraftUserState>(() => ({
        userId: user.id,
        draftUser: getUserEditFormState(user),
    }));

    const isEditing = isOpen && editingUserId === user.id;
    const isSaving = savingUserId === user.id;
    const saveErrorMessage = saveError?.userId === user.id ? saveError.message : "";

    const draftUser =
        draftUserState.userId === user.id
            ? draftUserState.draftUser
            : getUserEditFormState(user);

    const visibleTitle = isEditing
        ? getDraftDisplayName(user, draftUser)
        : getDisplayName(user);

    const visiblePermissionGroup = isEditing
        ? draftUser.permissionGroup
        : user.permissionGroup;

    const visibleEnabled = isEditing ? draftUser.enabled : user.enabled;

    const closeDrawer = () => {
        setEditingUserId(null);
        setSaveError(null);
        onClose();
    };

    const startEditing = () => {
        setDraftUserState({
            userId: user.id,
            draftUser: getUserEditFormState(user),
        });
        setSaveError(null);
        setEditingUserId(user.id);
    };

    const cancelEditing = () => {
        setDraftUserState({
            userId: user.id,
            draftUser: getUserEditFormState(user),
        });
        setSaveError(null);
        setEditingUserId(null);
    };

    const updateDraftField = (
        field: Exclude<keyof UserEditFormState, "enabled">,
        value: string,
    ) => {
        setDraftUserState((currentDraftUserState) => {
            const currentDraftUser =
                currentDraftUserState.userId === user.id
                    ? currentDraftUserState.draftUser
                    : getUserEditFormState(user);

            return {
                userId: user.id,
                draftUser: {
                    ...currentDraftUser,
                    [field]: value,
                },
            };
        });
    };

    const updateDraftEnabled = (enabled: boolean) => {
        setDraftUserState((currentDraftUserState) => {
            const currentDraftUser =
                currentDraftUserState.userId === user.id
                    ? currentDraftUserState.draftUser
                    : getUserEditFormState(user);

            return {
                userId: user.id,
                draftUser: {
                    ...currentDraftUser,
                    enabled,
                },
            };
        });
    };

    const saveUserChanges = async () => {
        const request: UpdateAdminUserRequest = {
            email: draftUser.email.trim(),
            firstName: draftUser.firstName.trim(),
            lastName: draftUser.lastName.trim(),
            permissionGroup: draftUser.permissionGroup.trim(),
        };

        if (!request.email) {
            setSaveError({
                userId: user.id,
                message: "Email is required.",
            });
            return;
        }

        if (!request.permissionGroup) {
            setSaveError({
                userId: user.id,
                message: "Permission group is required.",
            });
            return;
        }

        setSavingUserId(user.id);
        setSaveError(null);

        try {
            let updatedUser = await adminUserService.updateUser(user.id, request);

            if (draftUser.enabled !== user.enabled) {
                updatedUser = await adminUserService.updateUserEnabled(user.id, {
                    enabled: draftUser.enabled,
                });
            }

            onUserUpdated(updatedUser);
            setDraftUserState({
                userId: updatedUser.id,
                draftUser: getUserEditFormState(updatedUser),
            });
            setEditingUserId(null);
        } catch (error) {
            setSaveError({
                userId: user.id,
                message:
                    error instanceof Error
                        ? error.message
                        : "User changes could not be saved.",
            });
        } finally {
            setSavingUserId((currentSavingUserId) =>
                currentSavingUserId === user.id ? null : currentSavingUserId,
            );
        }
    };

    return (
        <DetailsSideDrawer
            isOpen={isOpen}
            onClose={closeDrawer}
            title={visibleTitle}
            leading={
                <div className="flex shrink-0 items-center justify-center">
                    <UserAvatar profileIcon={user.profileIcon} fallbackName={`${user.firstName} ${user.lastName}`.trim()} seed={user.id} size={64} />
                </div>
            }
            badge={
                <AccessBadge variant={getPermissionGroupVariant(visiblePermissionGroup)}>
                    {visiblePermissionGroup}
                </AccessBadge>
            }
            actions={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={startEditing}
                        disabled={isEditing || isSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Edit className="h-4 w-4" />
                        Edit User
                    </button>

                    <button
                        type="button"
                        onClick={() => onRequestDelete(user)}
                        disabled={isSaving}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-app-surface text-app-danger-text transition-colors hover:bg-app-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Delete ${getDisplayName(user)}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            }
            footer={
                isEditing ? (
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSaving}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={() => void saveUserChanges()}
                            disabled={isSaving}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-app-brand bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:border-app-brand-hover hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4" />
                            )}
                            Save
                        </button>
                    </div>
                ) : undefined
            }
        >
            <UserStatusSection
                isEditing={isEditing}
                enabled={visibleEnabled}
                onboardingCompleted={user.hasCompletedOnboarding}
                disabled={isSaving}
                onEnabledChange={updateDraftEnabled}
            />

            <Section>
                {saveErrorMessage && (
                    <div className="mb-5 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-app-danger-text">
                            <AlertCircle className="h-4 w-4" />
                            User changes could not be saved
                        </div>
                        <p className="mt-1 text-sm text-app-danger-text">
                            {saveErrorMessage}
                        </p>
                    </div>
                )}

                <dl>
                    {isEditing ? (
                        <>
                            <DetailRow label="Username" value={user.username} />
                            <EditableDetailRow
                                label="Email"
                                value={draftUser.email}
                                onChange={(value) => updateDraftField("email", value)}
                                type="email"
                                autoComplete="email"
                            />
                            <EditableDetailRow
                                label="First name"
                                value={draftUser.firstName}
                                onChange={(value) => updateDraftField("firstName", value)}
                                autoComplete="given-name"
                            />
                            <EditableDetailRow
                                label="Last name"
                                value={draftUser.lastName}
                                onChange={(value) => updateDraftField("lastName", value)}
                                autoComplete="family-name"
                            />
                            <EditableSelectDetailRow
                                label="Role"
                                value={draftUser.permissionGroup}
                                onChange={(value) => updateDraftField("permissionGroup", value)}
                                options={PERMISSION_GROUP_OPTIONS}
                            />
                            <DetailRow label="User ID" value={user.id} mono />
                        </>
                    ) : (
                        <>
                            <DetailRow label="Email" value={user.email} />
                            <DetailRow label="Username" value={user.username} />
                            <DetailRow label="First name" value={user.firstName} />
                            <DetailRow label="Last name" value={user.lastName} />
                            <DetailRow
                                label="Project roles"
                                value={
                                    user.roles.length > 0
                                        ? user.roles.map((role) => role.name).join(", ")
                                        : "No role assigned"
                                }
                            />
                            <DetailRow label="Role" value={user.permissionGroup} />
                            <DetailRow label="User ID" value={user.id} mono />
                        </>
                    )}
                </dl>
            </Section>

            <Section>
                <UserRolesPanel
                    userId={user.id}
                    assignedRoles={user.roles}
                    onRolesChanged={(roles) =>
                        onUserUpdated({
                            ...user,
                            roles: roles.map((role) => ({ ...role, type: "primary" as const })),
                        })
                    }
                />
            </Section>

            <Section>
                <ProjectAccessPanel
                    assignedProjects={user.projects}
                    availableProjects={availableProjects}
                    onOpenProjectDetails={onOpenProjectDetails}
                />
            </Section>
        </DetailsSideDrawer>
    );
}
