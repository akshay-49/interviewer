import React, { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';

const InviteCandidateScreen = () => {
    const { navigateTo } = useInterview();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        role: '',
        seniorityLevel: '',
        jobDescription: '',
        recordingMode: 'audio'
    });
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [toastMessage, setToastMessage] = useState({ title: '', subtitle: '' });
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSent: 0,
        pending: 0,
        activeLinks: 0
    });
    const [submitting, setSubmitting] = useState(false);

    // Fetch invitations from backend
    useEffect(() => {
        fetchInvitations();
    }, []);

    const fetchInvitations = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/admin/get-invites');
            if (response.ok) {
                const data = await response.json();
                const invitesList = data.invites || [];
                setInvitations(invitesList);
                
                // Calculate stats
                const totalSent = invitesList.length;
                const pending = invitesList.filter(inv => inv.status === 'pending').length;
                const activeLinks = invitesList.filter(inv => inv.status !== 'used' && inv.status !== 'expired').length;
                
                setStats({
                    totalSent,
                    pending,
                    activeLinks
                });
            }
        } catch (error) {
            console.error('Error fetching invitations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (submitting) {
            return;
        }

        setSubmitting(true);
        
        try {
            const response = await fetch('http://localhost:8000/admin/send-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to send invite');
            }
            
            const data = await response.json();
            console.log('Invite sent:', data);
            
            setToastMessage({ 
                title: 'Invitation Sent!', 
                subtitle: `Link created for ${formData.fullName || 'candidate'}.` 
            });
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 5000);
            
            // Reset form
            setFormData({
                fullName: '',
                email: '',
                role: '',
                seniorityLevel: '',
                jobDescription: '',
                recordingMode: 'audio'
            });
            
            // Refetch invitations from database
            fetchInvitations();
        } catch (error) {
            console.error('Error sending invite:', error);
            alert('Failed to send invite. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getInitials = (name) => {
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].substring(0, 2);
    };

    const getStatusColor = (status) => {
        switch(status.toLowerCase()) {
            case 'sent': return 'bg-blue-100 text-blue-700';
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'completed': return 'bg-green-100 text-green-700';
            case 'expired': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const handleAccessToggle = async (invite) => {
        try {
            const response = await fetch(`http://localhost:8000/admin/toggle-access/${invite.invite_code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_enabled: !invite.access_enabled })
            });
            
            if (response.ok) {
                fetchInvitations();
            } else {
                alert('Failed to toggle access');
            }
        } catch (error) {
            console.error('Error toggling access:', error);
            alert('Failed to toggle access');
        }
    };

    const handleDeleteInvite = async (invite) => {
        if (!window.confirm(`Are you sure you want to revoke access for ${invite.candidate_name}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`http://localhost:8000/admin/delete-invite/${invite.invite_code}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                setToastMessage({ 
                    title: 'Access Revoked!', 
                    subtitle: `Invite for ${invite.candidate_name} has been deleted.` 
                });
                setShowSuccessToast(true);
                setTimeout(() => setShowSuccessToast(false), 5000);
                fetchInvitations();
            } else {
                alert('Failed to delete invite');
            }
        } catch (error) {
            console.error('Error deleting invite:', error);
            alert('Failed to delete invite');
        }
    };

    return (
        <>
            {/* Page Heading */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex flex-col gap-1">
                    <h1 className="text-[#0d191b] text-3xl font-black leading-tight tracking-tight">Candidate Invitations</h1>
                    <p className="text-[#4c8e9a] text-base font-normal">Create new interview access and track current pending statuses.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e7f1f3] text-[#0d191b] text-sm font-bold hover:bg-[#d8e8eb] transition-all">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                        View Analytics
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all">
                        <span className="material-symbols-outlined text-[18px]">ios_share</span>
                        Export CSV
                    </button>
                </div>
            </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Side: Invitation Form */}
                    <aside className="lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-[#e7f1f3] p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="material-symbols-outlined text-primary">person_add</span>
                            <h2 className="text-xl font-bold">Invite New Candidate</h2>
                        </div>
                        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                            {/* Candidate Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Full Name</label>
                                <input 
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    className="w-full h-12 px-4 rounded-lg border border-[#cfe4e7] bg-[#f8fbfc] text-[#0d191b] focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                                    placeholder="Sarah Jenkins" 
                                    type="text"
                                    required
                                />
                            </div>

                            {/* Email Address */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Email Address</label>
                                <input 
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="w-full h-12 px-4 rounded-lg border border-[#cfe4e7] bg-[#f8fbfc] text-[#0d191b] focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                                    placeholder="sarah.j@example.com" 
                                    type="email"
                                    required
                                />
                            </div>

                            {/* Recording Mode */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Recording Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg border ${formData.recordingMode === 'audio' ? 'border-primary bg-primary/5' : 'border-[#cfe4e7] bg-[#f8fbfc]'} cursor-pointer transition-all`}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[20px] text-[#4c8e9a]">mic</span>
                                            <span className="text-sm font-semibold text-[#0d191b]">Audio</span>
                                        </div>
                                        <input
                                            type="radio"
                                            name="recordingMode"
                                            value="audio"
                                            checked={formData.recordingMode === 'audio'}
                                            onChange={handleInputChange}
                                            className="accent-primary"
                                        />
                                    </label>
                                    <label className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg border ${formData.recordingMode === 'video' ? 'border-primary bg-primary/5' : 'border-[#cfe4e7] bg-[#f8fbfc]'} cursor-pointer transition-all`}>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[20px] text-[#4c8e9a]">videocam</span>
                                            <span className="text-sm font-semibold text-[#0d191b]">Video</span>
                                        </div>
                                        <input
                                            type="radio"
                                            name="recordingMode"
                                            value="video"
                                            checked={formData.recordingMode === 'video'}
                                            onChange={handleInputChange}
                                            className="accent-primary"
                                        />
                                    </label>
                                </div>
                                <p className="text-xs text-[#4c8e9a]">Select how the candidate will record their answers.</p>
                            </div>

                            {/* Role / Position */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Role / Position</label>
                                <input 
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    className="w-full h-12 px-4 rounded-lg border border-[#cfe4e7] bg-[#f8fbfc] text-[#0d191b] focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                                    placeholder="e.g. Senior Frontend Engineer" 
                                    type="text"
                                />
                            </div>

                            {/* Seniority Level */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Seniority Level</label>
                                <input 
                                    name="seniorityLevel"
                                    value={formData.seniorityLevel}
                                    onChange={handleInputChange}
                                    className="w-full h-12 px-4 rounded-lg border border-[#cfe4e7] bg-[#f8fbfc] text-[#0d191b] focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
                                    placeholder="e.g. Senior, Mid-level, Junior" 
                                    type="text"
                                />
                            </div>

                            {/* Job Description Area */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Job Description / Notes</label>
                                <textarea 
                                    name="jobDescription"
                                    value={formData.jobDescription}
                                    onChange={handleInputChange}
                                    className="w-full h-32 p-4 rounded-lg border border-[#cfe4e7] bg-[#f8fbfc] text-[#0d191b] focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none" 
                                    placeholder="Paste the JD here or add specific interview notes for the recruiter..."
                                ></textarea>
                                <button className="flex items-center gap-2 text-primary text-xs font-bold hover:underline" type="button">
                                    <span className="material-symbols-outlined text-sm">upload_file</span>
                                    Upload JD Document instead
                                </button>
                            </div>

                            <button 
                                type="submit"
                                disabled={submitting}
                                className="w-full h-14 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined">send</span>
                                {submitting ? 'Sending...' : 'Send Invitation'}
                            </button>
                        </form>
                    </aside>

                    {/* Right Side: Management Table */}
                    <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                        {/* Status Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Total Sent</p>
                                <h3 className="text-2xl font-black mt-1">{stats.totalSent}</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Pending</p>
                                <h3 className="text-2xl font-black mt-1 text-primary">{stats.pending}</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Active Links</p>
                                <h3 className="text-2xl font-black mt-1 text-green-500">{stats.activeLinks}</h3>
                            </div>
                        </div>

                        {/* Table Card */}
                        <div className="bg-white rounded-xl border border-[#e7f1f3] overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-[#e7f1f3] flex flex-col sm:flex-row justify-between items-center gap-4">
                                <h3 className="text-lg font-bold">Pending & Sent Invites</h3>
                                <div className="flex gap-2">
                                    <button className="p-2 border border-[#cfe4e7] rounded hover:bg-[#f8fbfc]">
                                        <span className="material-symbols-outlined text-xl">filter_list</span>
                                    </button>
                                    <button className="p-2 border border-[#cfe4e7] rounded hover:bg-[#f8fbfc]">
                                        <span className="material-symbols-outlined text-xl">refresh</span>
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                                    <thead>
                                        <tr className="bg-[#f8fbfc] text-[#4c8e9a] text-xs font-bold uppercase">
                                            <th className="px-6 py-4">Candidate</th>
                                            <th className="px-6 py-4">Role / Level</th>
                                                            <th className="px-6 py-4">Interview Type</th>
                                            <th className="px-6 py-4">Date Sent</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-center">Access</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e7f1f3]">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-[#4c8e9a]">
                                                    Loading invitations...
                                                </td>
                                            </tr>
                                        ) : invitations.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-8 text-center text-[#4c8e9a]">
                                                    No invitations sent yet
                                                </td>
                                            </tr>
                                        ) : (
                                            invitations.map((invite) => {
                                                const createdDate = new Date(invite.created_at);
                                                const formattedDate = createdDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                                                const formattedTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                
                                                return (
                                                    <tr key={invite.id} className="hover:bg-primary/5 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`size-9 rounded-full flex items-center justify-center font-bold ${invite.status === 'used' ? 'bg-[#e7f1f3] text-[#4c8e9a]' : 'bg-primary/20 text-primary'}`}>
                                                                    {getInitials(invite.candidate_name)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-sm">{invite.candidate_name}</p>
                                                                    <p className="text-xs text-[#4c8e9a]">{invite.candidate_email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold">{invite.role || 'Candidate'}</span>
                                                                <span className="text-[10px] text-[#4c8e9a] font-bold uppercase">{invite.seniority_level}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-[#e7f1f3] text-[#0d191b]">
                                                                <span className="material-symbols-outlined text-[14px]">
                                                                    {invite.recording_mode === 'video' ? 'videocam' : 'mic'}
                                                                </span>
                                                                {invite.recording_mode === 'video' ? 'Video Interview' : 'Audio Interview'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-sm">{formattedDate}</p>
                                                            <p className="text-[10px] text-[#4c8e9a]">{formattedTime}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(invite.status)}`}>
                                                                {invite.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button 
                                                                onClick={() => handleAccessToggle(invite)}
                                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${invite.access_enabled !== false ? 'bg-primary' : 'bg-gray-200'}`}
                                                            >
                                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${invite.access_enabled !== false ? 'translate-x-6' : 'translate-x-1'}`}></span>
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button 
                                                                onClick={() => handleDeleteInvite(invite)}
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Revoke access and delete"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-4 bg-[#f8fbfc] flex items-center justify-between">
                                <p className="text-xs text-[#4c8e9a] font-semibold">Showing {invitations.length} of {stats.totalSent} results</p>
                                <div className="flex gap-1">
                                    <button className="size-8 flex items-center justify-center rounded border border-[#cfe4e7] text-[#4c8e9a] hover:bg-white">
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                    </button>
                                    <button className="size-8 flex items-center justify-center rounded bg-primary text-white font-bold text-xs">1</button>
                                    <button className="size-8 flex items-center justify-center rounded border border-[#cfe4e7] text-[#4c8e9a] hover:bg-white text-xs font-bold">2</button>
                                    <button className="size-8 flex items-center justify-center rounded border border-[#cfe4e7] text-[#4c8e9a] hover:bg-white text-xs font-bold">3</button>
                                    <button className="size-8 flex items-center justify-center rounded border border-[#cfe4e7] text-[#4c8e9a] hover:bg-white">
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            {/* Success Toast */}
            {showSuccessToast && (
                <div className="fixed bottom-6 right-6 flex items-center gap-4 bg-[#0d191b] text-white p-4 rounded-xl shadow-2xl border-l-4 border-primary animate-slide-in-right">
                    <div className="size-8 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">check</span>
                    </div>
                    <div>
                        <p className="font-bold text-sm">{toastMessage.title}</p>
                        <p className="text-xs text-gray-400">{toastMessage.subtitle}</p>
                    </div>
                    <button 
                        className="ml-4 text-gray-400 hover:text-white"
                        onClick={() => setShowSuccessToast(false)}
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}
        </>
    );
};

export default InviteCandidateScreen;
