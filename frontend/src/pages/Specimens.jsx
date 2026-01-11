import { useState, useEffect, useRef } from 'react'
import { useSettings } from '../context/SettingsContext'

const healthOptions = [
  { value: 'excellent', label: 'Excellent', color: 'bg-kurz-green' },
  { value: 'fair', label: 'Fair', color: 'bg-kurz-yellow' },
  { value: 'critical', label: 'Critical', color: 'bg-kurz-pink' }
]

function Specimens() {
  const [specimens, setSpecimens] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedSpecimen, setExpandedSpecimen] = useState(null)
  const [editingSpecimen, setEditingSpecimen] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [specimenNotes, setSpecimenNotes] = useState({})
  const [showAllNotes, setShowAllNotes] = useState({})
  const [newNoteText, setNewNoteText] = useState({})
  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)
  const { formatDateOnly, formatRelativeDate, formatTime, formatAge, getDateString } = useSettings()

  const [newSpecimen, setNewSpecimen] = useState({
    name: '',
    species: '',
    health: 'excellent',
    acquired_at: '',
    image: null
  })

  // Set default date when form is opened
  const handleOpenAddForm = () => {
    if (!showAddForm) {
      setNewSpecimen(prev => ({
        ...prev,
        acquired_at: getDateString()
      }))
    }
    setShowAddForm(!showAddForm)
  }

  const fetchSpecimens = async () => {
    try {
      const res = await fetch('/api/specimens')
      if (res.ok) {
        const data = await res.json()
        setSpecimens(data)
      }
    } catch (err) {
      // Silently ignore fetch errors
    } finally {
      setLoading(false)
    }
  }

  const fetchNotes = async (specimenId) => {
    try {
      const res = await fetch(`/api/specimens/${specimenId}/notes`)
      if (res.ok) {
        const data = await res.json()
        setSpecimenNotes(prev => ({ ...prev, [specimenId]: data }))
      }
    } catch (err) {
      // Silently ignore fetch errors
    }
  }

  useEffect(() => {
    fetchSpecimens()
  }, [])

  useEffect(() => {
    if (expandedSpecimen) {
      fetchNotes(expandedSpecimen)
    }
  }, [expandedSpecimen])

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewSpecimen({ ...newSpecimen, image: reader.result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditForm({ ...editForm, image: reader.result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddSpecimen = async (e) => {
    e.preventDefault()
    const specimenToAdd = { ...newSpecimen }

    // Optimistic UI: close form and reset immediately
    setNewSpecimen({
      name: '',
      species: '',
      health: 'excellent',
      acquired_at: '',
      image: null
    })
    setShowAddForm(false)

    try {
      const res = await fetch('/api/specimens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specimenToAdd)
      })
      if (res.ok) {
        fetchSpecimens()
      }
    } catch (err) {
      // Silently ignore add errors
    }
  }

  const handleUpdateSpecimen = async (id, updates) => {
    try {
      const res = await fetch(`/api/specimens/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        fetchSpecimens()
      }
    } catch (err) {
      // Silently ignore update errors
    }
  }

  const handleSaveEdit = async (id) => {
    try {
      const res = await fetch(`/api/specimens/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        setEditingSpecimen(null)
        fetchSpecimens()
      }
    } catch (err) {
      // Silently ignore update errors
    }
  }

  const handleDeleteSpecimen = async (id) => {
    if (!confirm('Delete this specimen?')) return
    try {
      const res = await fetch(`/api/specimens/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchSpecimens()
        setExpandedSpecimen(null)
      }
    } catch (err) {
      // Silently ignore delete errors
    }
  }

  const handleAddNote = async (specimenId) => {
    const content = newNoteText[specimenId]?.trim()
    if (!content) return

    try {
      const res = await fetch(`/api/specimens/${specimenId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if (res.ok) {
        setNewNoteText(prev => ({ ...prev, [specimenId]: '' }))
        fetchNotes(specimenId)
      }
    } catch (err) {
      // Silently ignore add errors
    }
  }

  const handleDeleteNote = async (specimenId, noteId) => {
    try {
      const res = await fetch(`/api/specimens/${specimenId}/notes/${noteId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchNotes(specimenId)
      }
    } catch (err) {
      // Silently ignore delete errors
    }
  }

  const handleClearAllNotes = async (specimenId) => {
    if (!confirm('Clear all notes for this specimen?')) return
    try {
      const res = await fetch(`/api/specimens/${specimenId}/notes`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchNotes(specimenId)
      }
    } catch (err) {
      // Silently ignore delete errors
    }
  }

  const startEditing = (specimen) => {
    setEditingSpecimen(specimen.id)
    setEditForm({
      name: specimen.name,
      species: specimen.species || '',
      health: specimen.health,
      acquired_at: specimen.acquired_at?.split('T')[0] || '',
      image: specimen.image
    })
  }

  const getHealthColor = (health) => {
    return healthOptions.find(h => h.value === health)?.color || 'bg-slate-400'
  }

  const formatNoteDate = (dateStr) => {
    if (!dateStr) return '--'
    const relative = formatRelativeDate(dateStr)
    if (relative === 'Today') {
      return 'Today ' + formatTime(dateStr)
    }
    return relative
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-kurz-cyan animate-spin">sync</span>
          <p className="text-sm text-slate-400 mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-black text-xl uppercase italic tracking-tighter text-kurz-dark">
            Specimen Registry
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {specimens.length} Specimens Catalogued
          </p>
        </div>
        <button
          onClick={handleOpenAddForm}
          className={`w-10 h-10 kurz-border kurz-shadow-sm flex items-center justify-center ${
            showAddForm ? 'bg-kurz-pink' : 'bg-kurz-cyan'
          }`}
        >
          <span className="material-symbols-outlined text-kurz-dark">
            {showAddForm ? 'close' : 'add'}
          </span>
        </button>
      </div>

      {/* Add Specimen Form */}
      {showAddForm && (
        <form onSubmit={handleAddSpecimen} className="bg-white kurz-border kurz-card-shadow p-4 mb-4">
          <h3 className="font-display font-bold text-sm uppercase mb-4 text-kurz-dark">
            Add New Specimen
          </h3>

          <div className="space-y-3">
            {/* Image Upload */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Photo
              </label>
              <div className="flex gap-3 items-center">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-20 h-20 kurz-border flex items-center justify-center cursor-pointer overflow-hidden ${
                    newSpecimen.image ? '' : 'bg-slate-100'
                  }`}
                >
                  {newSpecimen.image ? (
                    <img src={newSpecimen.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-slate-400">add_a_photo</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {newSpecimen.image && (
                  <button
                    type="button"
                    onClick={() => setNewSpecimen({ ...newSpecimen, image: null })}
                    className="text-[10px] text-kurz-pink font-bold uppercase"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Name
              </label>
              <input
                type="text"
                value={newSpecimen.name}
                onChange={(e) => setNewSpecimen({ ...newSpecimen, name: e.target.value })}
                placeholder="e.g., Nemo"
                className="w-full p-2 kurz-border text-sm"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Species
              </label>
              <input
                type="text"
                value={newSpecimen.species}
                onChange={(e) => setNewSpecimen({ ...newSpecimen, species: e.target.value })}
                placeholder="e.g., Amphiprion ocellaris"
                className="w-full p-2 kurz-border text-sm"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Health Status
              </label>
              <div className="flex gap-2 flex-wrap">
                {healthOptions.map(h => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => setNewSpecimen({ ...newSpecimen, health: h.value })}
                    className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                      newSpecimen.health === h.value
                        ? `${h.color} text-kurz-dark`
                        : 'bg-white text-slate-500'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Date Acquired
              </label>
              <input
                type="date"
                value={newSpecimen.acquired_at}
                onChange={(e) => setNewSpecimen({ ...newSpecimen, acquired_at: e.target.value })}
                className="w-full p-2 kurz-border text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-kurz-green kurz-border kurz-shadow-sm p-3 font-bold uppercase text-sm text-kurz-dark"
            >
              Add Specimen
            </button>
          </div>
        </form>
      )}

      {/* Specimen List */}
      <div className="space-y-3">
        {specimens.length === 0 ? (
          <div className="bg-white kurz-border kurz-card-shadow p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">phishing</span>
            <p className="text-sm text-slate-400">No specimens registered yet</p>
            <p className="text-[10px] text-slate-300 mt-1">Add your first specimen to get started</p>
          </div>
        ) : (
          specimens.map(specimen => {
            const notes = specimenNotes[specimen.id] || []
            const showAll = showAllNotes[specimen.id]
            const displayNotes = showAll ? notes : notes.slice(0, 2)

            return (
              <div key={specimen.id} className="bg-white kurz-border kurz-card-shadow">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedSpecimen(expandedSpecimen === specimen.id ? null : specimen.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Photo or placeholder */}
                    <div className="w-14 h-14 kurz-border overflow-hidden flex-shrink-0 bg-kurz-purple flex items-center justify-center">
                      {specimen.image ? (
                        <img src={specimen.image} alt={specimen.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-white text-xl">phishing</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-sm text-kurz-dark truncate">
                          {specimen.name}
                        </h3>
                        <div className={`w-2.5 h-2.5 rounded-full ${getHealthColor(specimen.health)} border-2 border-black flex-shrink-0`}></div>
                      </div>
                      {specimen.species && (
                        <p className="text-[10px] italic text-slate-400 truncate">
                          {specimen.species}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {formatAge(specimen.acquired_at)}
                      </p>
                    </div>

                    <span className="material-symbols-outlined text-slate-400 flex-shrink-0">
                      {expandedSpecimen === specimen.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedSpecimen === specimen.id && (
                  <div className="border-t-2 border-slate-100 p-4">
                    {editingSpecimen === specimen.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        {/* Edit Image */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Photo
                          </label>
                          <div className="flex gap-3 items-center">
                            <div
                              onClick={() => editFileInputRef.current?.click()}
                              className={`w-16 h-16 kurz-border flex items-center justify-center cursor-pointer overflow-hidden ${
                                editForm.image ? '' : 'bg-slate-100'
                              }`}
                            >
                              {editForm.image ? (
                                <img src={editForm.image} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-xl text-slate-400">add_a_photo</span>
                              )}
                            </div>
                            <input
                              ref={editFileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleEditImageUpload}
                              className="hidden"
                            />
                            {editForm.image && (
                              <button
                                type="button"
                                onClick={() => setEditForm({ ...editForm, image: null })}
                                className="text-[10px] text-kurz-pink font-bold uppercase"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full p-2 kurz-border text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Species
                          </label>
                          <input
                            type="text"
                            value={editForm.species}
                            onChange={(e) => setEditForm({ ...editForm, species: e.target.value })}
                            className="w-full p-2 kurz-border text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Health Status
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {healthOptions.map(h => (
                              <button
                                key={h.value}
                                type="button"
                                onClick={() => setEditForm({ ...editForm, health: h.value })}
                                className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                                  editForm.health === h.value
                                    ? `${h.color} text-kurz-dark`
                                    : 'bg-white text-slate-500'
                                }`}
                              >
                                {h.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Date Acquired
                          </label>
                          <input
                            type="date"
                            value={editForm.acquired_at}
                            onChange={(e) => setEditForm({ ...editForm, acquired_at: e.target.value })}
                            className="w-full p-2 kurz-border text-sm"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleSaveEdit(specimen.id)}
                            className="flex-1 bg-kurz-green kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">save</span>
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSpecimen(null)}
                            className="flex-1 bg-slate-200 kurz-border p-2 font-bold uppercase text-[10px] text-kurz-dark flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        {/* Health Status Selector */}
                        <div className="mb-4">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Health Status
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {healthOptions.map(h => (
                              <button
                                key={h.value}
                                type="button"
                                onClick={() => handleUpdateSpecimen(specimen.id, { health: h.value })}
                                className={`px-3 py-2 kurz-border text-[10px] font-bold uppercase ${
                                  specimen.health === h.value
                                    ? `${h.color} text-kurz-dark`
                                    : 'bg-white text-slate-500'
                                }`}
                              >
                                {h.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-50 kurz-border p-3">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Species
                            </label>
                            <p className="text-sm text-kurz-dark italic">
                              {specimen.species || '--'}
                            </p>
                          </div>
                          <div className="bg-slate-50 kurz-border p-3">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Acquired
                            </label>
                            <p className="text-sm text-kurz-dark">
                              {formatDateOnly(specimen.acquired_at)}
                            </p>
                          </div>
                        </div>

                        {/* Notes Section */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Notes ({notes.length})
                            </label>
                            {notes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearAllNotes(specimen.id)}
                                className="text-[9px] text-kurz-pink font-bold uppercase flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">delete_sweep</span>
                                Clear All
                              </button>
                            )}
                          </div>

                          {/* Add Note Input */}
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              value={newNoteText[specimen.id] || ''}
                              onChange={(e) => setNewNoteText(prev => ({ ...prev, [specimen.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddNote(specimen.id)}
                              placeholder="Add a note..."
                              className="flex-1 p-2 kurz-border text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddNote(specimen.id)}
                              className="bg-kurz-cyan kurz-border px-3 flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-kurz-dark text-sm">add</span>
                            </button>
                          </div>

                          {/* Notes List */}
                          {notes.length > 0 ? (
                            <div className="space-y-2">
                              {displayNotes.map(note => (
                                <div key={note.id} className="bg-slate-50 kurz-border p-3 flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm text-kurz-dark">{note.content}</p>
                                    <p className="text-[9px] text-slate-400 mt-1">
                                      {formatNoteDate(note.created_at)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(specimen.id, note.id)}
                                    className="text-slate-400 hover:text-kurz-pink flex-shrink-0"
                                  >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                  </button>
                                </div>
                              ))}

                              {/* Show All / Show Less */}
                              {notes.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllNotes(prev => ({ ...prev, [specimen.id]: !showAll }))}
                                  className="text-[10px] text-kurz-blue font-bold uppercase flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    {showAll ? 'expand_less' : 'expand_more'}
                                  </span>
                                  {showAll ? 'Show Less' : `Show All ${notes.length} Notes`}
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">No notes yet</p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditing(specimen)}
                            className="flex-1 bg-kurz-blue kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-white flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSpecimen(specimen.id)}
                            className="flex-1 bg-kurz-pink kurz-border kurz-shadow-sm p-2 font-bold uppercase text-[10px] text-white flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Specimens
