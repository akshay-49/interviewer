import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const InviteCandidateScreen = () => {
    const { navigateTo } = useInterview();
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        seniorityLevel: 'Senior',
        interviewType: 'video',
        jobDescription: ''
    });
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [invitations, setInvitations] = useState([
        {
            id: 1,
            name: 'Alex Bennett',
            email: 'alex.b@outlook.com',
            role: 'Senior Frontend Eng.',
            level: 'Senior',
            dateSent: 'Oct 24, 2023',
            time: '10:45 AM',
            status: 'Pending',
            accessEnabled: true
        },
        {
            id: 2,
            name: 'Maria Silva',
            email: 'm.silva@tech.com',
            role: 'Product Designer',
            level: 'Lead',
            dateSent: 'Oct 23, 2023',
            time: '02:15 PM',
            status: 'Completed',
            accessEnabled: false
        },
        {
            id: 3,
            name: 'James Lee',
            email: 'james@startup.io',
            role: 'Data Analyst',
            level: 'Junior',
            dateSent: 'Oct 22, 2023',
            time: '09:00 AM',
            status: 'Invited',
            accessEnabled: true
        },
        {
            id: 4,
            name: 'Kevin Thompson',
            email: 'kevin@agency.com',
            role: 'Fullstack Dev',
            level: 'Middle',
            dateSent: 'Oct 22, 2023',
            time: '11:20 AM',
            status: 'Invited',
            accessEnabled: true
        }
    ]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // TODO: Send invitation API call
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
        
        // Reset form
        setFormData({
            fullName: '',
            email: '',
            seniorityLevel: 'Senior',
            interviewType: 'video',
            jobDescription: ''
        });
    };

    const getInitials = (name) => {
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].substring(0, 2);
    };

    const getStatusColor = (status) => {
        switch(status.toLowerCase()) {
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'completed': return 'bg-green-100 text-green-700';
            case 'invited': return 'bg-primary/10 text-primary';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="min-h-screen bg-[#f6f8f8]">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 w-full border-b border-[#e7f1f3] bg-white px-4 md:px-10 py-3 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between whitespace-nowrap">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <img src="/accellor-logo.svg" alt="Accellor" className="h-8"/>
                            <div className="h-6 w-px bg-[#e7f1f3]"></div>
                            <h2 className="text-[#0d191b] text-lg font-bold">Admin Portal</h2>
                        </div>
                        <nav className="hidden md:flex items-center gap-6">
                            <button 
                                onClick={() => navigateTo('admin-dashboard')}
                                className="text-sm font-semibold text-[#4c8e9a] hover:text-primary transition-colors"
                            >
                                Dashboard
                            </button>
                            <button 
                                onClick={() => navigateTo('admin-dashboard')}
                                className="text-sm font-semibold text-[#4c8e9a] hover:text-primary transition-colors"
                            >
                                Users
                            </button>
                            <button className="text-sm font-bold text-primary">
                                Candidates
                            </button>
                            <button className="text-sm font-semibold text-[#4c8e9a] hover:text-primary transition-colors">
                                Interviews
                            </button>
                            <button className="text-sm font-semibold text-[#4c8e9a] hover:text-primary transition-colors">
                                Settings
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block">
                            <label className="relative flex items-center w-64 h-10">
                                <span className="absolute left-3 text-[#4c8e9a] material-symbols-outlined text-[20px]">search</span>
                                <input 
                                    className="w-full h-full pl-10 pr-4 rounded-lg border-none bg-[#e7f1f3] text-[#0d191b] placeholder:text-[#4c8e9a] text-sm focus:ring-2 focus:ring-primary" 
                                    placeholder="Search candidates..." 
                                    type="text"
                                />
                            </label>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-2 text-[#4c8e9a] hover:bg-[#e7f1f3] rounded-full transition-all">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                            <div 
                                className="size-10 rounded-full bg-cover bg-center border-2 border-primary/20" 
                                style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCebUrNZrJGf5OGI3kxMDy0XBDilXIii1RAE48Lha0yBw50-rD4BJW_5i3ZtkmD9TglLPbDx3w-CEuGku1jBqkBDN9QET0GOupnqKFKKcjhrLaqbkYu7IxsVhCbxooOU3sZ_cIbLT3-4lMbgQ5q-mWbniF_dipStb8OWPaTEYH8i5dATlQtWJ7wDi6O92aWQXRfk9x4Q5TCi4fL6r0yrfALusba4mdqNRiP12q4m2f8HGMsvSHk3_6WBkgLLax2SwThgxV9HtyjGJZ_")'}}
                            ></div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-10">
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

                            {/* Seniority Level */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Seniority Level</label>
                                <div className="relative">
                                    <select 
                                        name="seniorityLevel"
                                        value={formData.seniorityLevel}
                                        onChange={handleInputChange}
                                        className="w-full h-12 pl-4 pr-10 appearance-none rounded-lg border border-[#cfe4e7] bg-[#f8fbfc] text-[#0d191b] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                    >
                                        <option>Junior</option>
                                        <option>Middle</option>
                                        <option>Senior</option>
                                        <option>Lead</option>
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#4c8e9a] pointer-events-none">unfold_more</span>
                                </div>
                            </div>

                            {/* Interview Type Radio Buttons */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#0d191b]">Interview Type</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${formData.interviewType === 'video' ? 'border border-primary/30 bg-primary/5' : 'border border-[#cfe4e7] hover:bg-[#f8fbfc]'}`}>
                                        <input 
                                            type="radio" 
                                            name="interviewType" 
                                            value="video"
                                            checked={formData.interviewType === 'video'}
                                            onChange={handleInputChange}
                                            className="text-primary focus:ring-primary" 
                                        />
                                        <span className={`material-symbols-outlined ${formData.interviewType === 'video' ? 'text-primary' : 'text-[#4c8e9a]'}`}>videocam</span>
                                        <span className="text-sm font-semibold">Video Call</span>
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${formData.interviewType === 'audio' ? 'border border-primary/30 bg-primary/5' : 'border border-[#cfe4e7] hover:bg-[#f8fbfc]'}`}>
                                        <input 
                                            type="radio" 
                                            name="interviewType" 
                                            value="audio"
                                            checked={formData.interviewType === 'audio'}
                                            onChange={handleInputChange}
                                            className="text-primary focus:ring-primary" 
                                        />
                                        <span className={`material-symbols-outlined ${formData.interviewType === 'audio' ? 'text-primary' : 'text-[#4c8e9a]'}`}>call</span>
                                        <span className="text-sm font-semibold text-[#4c8e9a]">Audio Call</span>
                                    </label>
                                </div>
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
                                className="w-full h-14 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-lg mt-2"
                            >
                                <span className="material-symbols-outlined">send</span>
                                Send Invitation
                            </button>
                        </form>
                    </aside>

                    {/* Right Side: Management Table */}
                    <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                        {/* Status Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Total Sent</p>
                                <h3 className="text-2xl font-black mt-1">1,284</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Pending</p>
                                <h3 className="text-2xl font-black mt-1 text-primary">42</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Active Links</p>
                                <h3 className="text-2xl font-black mt-1 text-green-500">118</h3>
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
                                            <th className="px-6 py-4">Date Sent</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Access</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e7f1f3]">
                                        {invitations.map((invite) => (
                                            <tr key={invite.id} className="hover:bg-primary/5 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`size-9 rounded-full flex items-center justify-center font-bold ${invite.status === 'Completed' ? 'bg-[#e7f1f3] text-[#4c8e9a]' : 'bg-primary/20 text-primary'}`}>
                                                            {getInitials(invite.name)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm">{invite.name}</p>
                                                            <p className="text-xs text-[#4c8e9a]">{invite.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold">{invite.role}</span>
                                                        <span className="text-[10px] text-[#4c8e9a] font-bold uppercase">{invite.level}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm">{invite.dateSent}</p>
                                                    <p className="text-[10px] text-[#4c8e9a]">{invite.time}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(invite.status)}`}>
                                                        {invite.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${invite.accessEnabled ? 'bg-primary' : 'bg-gray-200'}`}>
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${invite.accessEnabled ? 'translate-x-6' : 'translate-x-1'}`}></span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-4 bg-[#f8fbfc] flex items-center justify-between">
                                <p className="text-xs text-[#4c8e9a] font-semibold">Showing 4 of 1,284 results</p>
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
            </main>

            {/* Success Toast */}
            {showSuccessToast && (
                <div className="fixed bottom-6 right-6 flex items-center gap-4 bg-[#0d191b] text-white p-4 rounded-xl shadow-2xl border-l-4 border-primary animate-slide-in-right">
                    <div className="size-8 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">check</span>
                    </div>
                    <div>
                        <p className="font-bold text-sm">Invitation Sent!</p>
                        <p className="text-xs text-gray-400">Link created for {formData.fullName || 'candidate'}.</p>
                    </div>
                    <button 
                        className="ml-4 text-gray-400 hover:text-white"
                        onClick={() => setShowSuccessToast(false)}
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default InviteCandidateScreen;
