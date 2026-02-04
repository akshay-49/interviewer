import React, { useState, useEffect } from 'react';

export default function QuestionBankScreen() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedExperience, setSelectedExperience] = useState('All Experience');
  const [stats, setStats] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch questions on component mount
  useEffect(() => {
    fetchQuestions();
    fetchStats();
  }, []);

  const fetchQuestions = async (category = null, role = null, experience = null) => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (role && role !== 'All Roles') params.append('role', role);
      if (experience && experience !== 'All Experience') params.append('experience', experience);
      
      const response = await fetch(`http://localhost:8000/admin/get-questions?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      console.log('✅ Fetched questions:', data.questions.length);
      
      // Transform API response to match frontend format
      const formattedQuestions = data.questions.map(q => ({
        id: q.id,
        text: q.text,
        category: q.category,
        categoryColor: getCategoryColor(q.category),
        role: q.role,
        experience: q.experience || 'Mid-Level',
        experienceColor: getExperienceColor(q.experience || 'Mid-Level'),
        lastUpdated: new Date(q.created_at).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }),
        usesCount: q.uses_count || 0
      }));
      
      setQuestions(formattedQuestions);
    } catch (err) {
      console.error('❌ Error fetching questions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:8000/admin/questions-stats');
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        console.log('📊 Question stats:', data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Technical': 'blue',
      'Behavioral': 'purple',
      'Architecture': 'orange',
      'Management': 'teal'
    };
    return colors[category] || 'blue';
  };

  const getExperienceColor = (experience) => {
    const colors = {
      'Intern': 'bg-slate-400',
      'Entry-level': 'bg-slate-400',
      'Junior': 'bg-green-500',
      'Mid-Level': 'bg-yellow-500',
      'Senior': 'bg-orange-500',
      'Staff': 'bg-red-500',
      'Principal': 'bg-purple-600'
    };
    return colors[experience] || colors['Mid-Level'];
  };

  const getCategoryStyles = (color) => {
    const styles = {
      blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
    };
    return styles[color] || styles.blue;
  };

  const handleApplyFilters = () => {
    const roleToApply = selectedRole === 'All Roles' ? null : selectedRole;
    const experienceToApply = selectedExperience === 'All Experience' ? null : selectedExperience;
    fetchQuestions(null, roleToApply, experienceToApply);
  };

  const toggleQuestionSelection = (questionId) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const handleDeleteSingle = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`http://localhost:8000/admin/question/${questionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete question');
      }
      
      setQuestions(questions.filter(q => q.id !== questionId));
      setSelectedQuestions(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
      
      console.log('✅ Question deleted successfully');
    } catch (err) {
      console.error('❌ Error deleting question:', err);
      alert('Failed to delete question: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedQuestions.size === 0) {
      alert('No questions selected');
      return;
    }
    
    if (!window.confirm(`Delete ${selectedQuestions.size} question(s)? This cannot be undone.`)) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch('http://localhost:8000/admin/questions/delete-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_ids: Array.from(selectedQuestions).map(id => String(id))
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete questions');
      }
      
      const data = await response.json();
      
      setQuestions(questions.filter(q => !selectedQuestions.has(q.id)));
      setSelectedQuestions(new Set());
      fetchStats();
      
      console.log(`✅ Deleted ${data.deleted_count} questions`);
      if (data.failed_count > 0) {
        alert(`Deleted ${data.deleted_count} questions, but ${data.failed_count} failed`);
      }
    } catch (err) {
      console.error('❌ Error deleting questions:', err);
      alert('Failed to delete questions: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'All Roles' || q.role === selectedRole;
    const matchesExperience = selectedExperience === 'All Experience' || q.experience === selectedExperience;
    return matchesSearch && matchesRole && matchesExperience;
  });

  return (
    <main className="flex-1 flex flex-col overflow-y-auto">
      <div className="max-w-[1200px] w-full mx-auto p-8 flex flex-col gap-6">
        
        {/* Page Heading */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[#0d171b] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">
              Question Bank Library
            </h1>
            <p className="text-[#4c829a] text-base font-normal leading-normal">
              {stats ? `${stats.total_questions} questions` : 'Loading...'} • Manage and organize your interview question repository for AI evaluation.
            </p>
          </div>
          <button className="flex min-w-[160px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:shadow-lg transition-all shadow-primary/20">
            <span className="material-symbols-outlined">add</span>
            <span className="truncate">Add New Question</span>
          </button>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white dark:bg-background-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          
          {/* Search Bar */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <label className="flex flex-col min-w-40 h-12 w-full">
              <div className="flex w-full flex-1 items-stretch rounded-lg h-full">
                <div className="text-[#4c829a] flex border-none bg-gray-100 dark:bg-gray-800 items-center justify-center pl-4 rounded-l-lg">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d171b] dark:text-white focus:outline-0 focus:ring-0 border-none bg-gray-100 dark:bg-gray-800 focus:border-none h-full placeholder:text-[#4c829a] px-4 rounded-l-none pl-3 text-base font-normal leading-normal"
                  placeholder="Search questions, topics, or keywords..."
                />
              </div>
            </label>
          </div>

          {/* Filter Chips Section */}
          <div className="px-6 py-4 flex flex-col gap-4">
            
            {/* Role Filters */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#4c829a] uppercase tracking-wider">Role</label>
              <div className="flex gap-2 flex-wrap">
                {['All Roles', 'Frontend', 'Backend', 'DevOps', 'Data Science'].map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role);
                      if (role !== 'All Roles') {
                        handleApplyFilters();
                      }
                    }}
                    className={`h-9 px-4 rounded-lg text-sm font-semibold transition-all ${
                      selectedRole === role
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#0d171b] dark:text-white hover:border-primary hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Filters */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#4c829a] uppercase tracking-wider">Experience</label>
              <div className="flex gap-2 flex-wrap">
                {['All Experience', 'Intern', 'Entry-level', 'Junior', 'Mid-Level', 'Senior', 'Staff', 'Principal'].map((experience) => (
                  <button
                    key={experience}
                    onClick={() => {
                      setSelectedExperience(experience);
                      if (experience !== 'All Experience') {
                        handleApplyFilters();
                      }
                    }}
                    className={`h-9 px-4 rounded-lg text-sm font-semibold transition-all ${
                      selectedExperience === experience
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#0d171b] dark:text-white hover:border-primary hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    {experience}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Display */}
            {(selectedRole !== 'All Roles' || selectedExperience !== 'All Experience') && (
              <div className="flex items-center gap-3 pt-2">
                <div className="text-sm text-[#4c829a]">
                  {selectedRole !== 'All Roles' && selectedExperience !== 'All Experience' 
                    ? `Filters: ${selectedRole} • ${selectedExperience}` 
                    : selectedRole !== 'All Roles' 
                    ? `Filters: ${selectedRole}` 
                    : `Filters: ${selectedExperience}`}
                </div>
                <button
                  onClick={() => {
                    setSelectedRole('All Roles');
                    setSelectedExperience('All Experience');
                    setSearchTerm('');
                  }}
                  className="text-primary hover:text-primary/80 text-sm font-semibold flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-background-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="inline-block animate-spin">
              <span className="material-symbols-outlined text-primary text-5xl">sync</span>
            </div>
            <p className="text-[#4c829a] mt-4">Loading questions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
            <span className="material-symbols-outlined text-lg">error</span> {error}
          </div>
        )}

        {/* Data Table */}
        {!loading && (
          <div className="bg-white dark:bg-background-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Selection Toolbar */}
            {selectedQuestions.size > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-4 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedQuestions.size} question{selectedQuestions.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleDeleteMultiple}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">delete</span>
                  Delete Selected
                </button>
              </div>
            )}
            
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.size > 0 && selectedQuestions.size === filteredQuestions.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-[#4c829a] uppercase tracking-wider">Question Text</th>
                  <th className="px-6 py-4 text-xs font-bold text-[#4c829a] uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-[#4c829a] uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-bold text-[#4c829a] uppercase tracking-wider">Experience</th>
                  <th className="px-6 py-4 text-xs font-bold text-[#4c829a] uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-4 text-xs font-bold text-[#4c829a] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredQuestions.length > 0 ? (
                  filteredQuestions.map((question) => (
                    <tr key={question.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors ${selectedQuestions.has(question.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <td className="px-6 py-4 w-12">
                        <input
                          type="checkbox"
                          checked={selectedQuestions.has(question.id)}
                          onChange={() => toggleQuestionSelection(question.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-sm font-medium text-[#0d171b] dark:text-white line-clamp-1">
                          {question.text}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getCategoryStyles(question.categoryColor)}`}>
                          {question.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#4c829a]">{question.role}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-2 rounded-full ${question.experienceColor}`}></span>
                          <span className="text-sm font-medium">{question.experience}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#4c829a]">{question.lastUpdated}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button className="text-primary hover:text-primary/80 font-bold text-sm flex items-center gap-1 transition-colors">
                            <span className="material-symbols-outlined text-lg">visibility</span>
                            Preview
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(question.id)}
                            disabled={isDeleting}
                            className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400 text-5xl">search_off</span>
                        <p className="text-[#4c829a]">No questions found matching your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50">
              <p className="text-sm text-[#4c829a]">Showing {filteredQuestions.length} of {questions.length} questions</p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-medium bg-white dark:bg-background-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Previous
                </button>
                <button className="px-3 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-medium bg-white dark:bg-background-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
