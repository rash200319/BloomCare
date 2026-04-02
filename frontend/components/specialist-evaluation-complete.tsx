/**
 * Stage 2 Specialist Diagnostics - Complete Implementation Example
 * Copy-paste ready components for your specialist portal
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  useSpecialistEvaluations,
  useEvaluationForm,
  useDiagnosticDetail,
  formatEvaluationData
} from '@/hooks/useSpecialistEvaluation';
import {
  DifferentialEvaluationRequest,
  PendingEvaluationItem,
  Stage2DiagnosticRecord,
  FORM_FIELDS,
  DISEASE_COLORS,
  DISEASE_DISPLAY_NAMES,
  RISK_LEVEL_COLORS
} from '@/types/specialist';

// ============================================================================
// COMPONENT 1: Pending Evaluations List
// ============================================================================

export function SpecialistPendingList({ token }: { token: string }) {
  const { pending, loading, error, refetch } = useSpecialistEvaluations(token);
  const [selectedPatient, setSelectedPatient] = useState<PendingEvaluationItem | null>(null);
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading pending evaluations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error loading evaluations</p>
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={refetch}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <p className="text-blue-800 font-semibold">No pending evaluations</p>
        <p className="text-blue-700 text-sm mt-1">All mothers have been evaluated!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Pending Evaluations ({pending.length})</h2>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {pending.map(patient => (
          <div
            key={patient.patient_id}
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
            onClick={() => setSelectedPatient(patient)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{patient.patient_name}</h3>
                <p className="text-gray-600">Age: {patient.age} | Blood Group: {patient.blood_group}</p>
                <p className="text-sm text-gray-700 mt-2">{patient.clinical_notes}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    Stage 1 Risk: {(patient.stage1_risk_score * 100).toFixed(0)}%
                  </span>
                  <span className={`px-2 py-1 rounded text-white ${
                    patient.stage1_classification === 'escalate' ? 'bg-red-600' :
                    patient.stage1_classification === 'monitor' ? 'bg-yellow-600' :
                    'bg-green-600'
                  }`}>
                    {patient.stage1_classification.toUpperCase()}
                  </span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Check for: {DISEASE_DISPLAY_NAMES[patient.disease_to_check as keyof typeof DISEASE_DISPLAY_NAMES]}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/specialist/evaluate/${patient.patient_id}/${patient.stage1_screening_id}`);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Evaluate
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail View Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
            <h2 className="text-2xl font-bold mb-4">{selectedPatient.patient_name}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-600">Age</p>
                <p className="font-semibold">{selectedPatient.age} years</p>
              </div>
              <div>
                <p className="text-gray-600">Blood Group</p>
                <p className="font-semibold">{selectedPatient.blood_group}</p>
              </div>
              <div>
                <p className="text-gray-600">Stage 1 Risk Score</p>
                <p className="font-semibold">{(selectedPatient.stage1_risk_score * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-gray-600">Disease to Check</p>
                <p className="font-semibold">{DISEASE_DISPLAY_NAMES[selectedPatient.disease_to_check]}</p>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-gray-600">Clinical Notes</p>
              <p>{selectedPatient.clinical_notes}</p>
            </div>
            <div className="mb-4">
              <p className="text-gray-600">Risk Factors</p>
              <ul className="list-disc list-inside mt-2">
                {selectedPatient.stage1_risk_factors.map((rf, i) => (
                  <li key={i}>
                    {rf.factor} (importance: {(rf.importance * 100).toFixed(0)}%)
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setSelectedPatient(null)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT 2: Evaluation Form
// ============================================================================

export function EvaluationFormComponent({
  patientId,
  screeningId,
  patientAge,
  token
}: {
  patientId: string;
  screeningId: string;
  patientAge: number;
  token: string;
}) {
  const router = useRouter();
  const { formState, isSubmitting, errors, updateField, submitEvaluation, resetForm } = useEvaluationForm(
    token,
    { patient_id: patientId, stage1_screening_id: screeningId, age: patientAge }
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    try {
      const result = await submitEvaluation();
      setDiagnosticId(result.stage2_diagnostic_id);
      // Auto-navigate to results after 2 seconds
      setTimeout(() => {
        router.push(`/specialist/results/${result.stage2_diagnostic_id}`);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setSubmitError(message);
    }
  };

  if (diagnosticId) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <p className="text-green-800 font-semibold text-lg">Diagnostic submitted successfully!</p>
        <p className="text-green-700 mt-2">Diagnostic ID: {diagnosticId}</p>
        <p className="text-green-700 text-sm mt-1">Redirecting to results...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Enter Diagnostic Measurements</h2>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">Submission Error</p>
          <p className="text-red-700 text-sm">{submitError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {FORM_FIELDS.map(field => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.unit && <span className="text-gray-500"> ({field.unit})</span>}
              {field.required && <span className="text-red-600">*</span>}
            </label>

            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={Boolean(formState[field.name] as boolean)}
                onChange={(e) => updateField(field.name, e.target.checked)}
                className="mt-1 h-4 w-4"
              />
            ) : (
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step || 1}
                value={typeof formState[field.name] === 'boolean' ? '' : (formState[field.name] ?? '')}
                onChange={(e) => {
                  const v = e.target.value;
                  updateField(field.name, v === '' ? 0 : Number(v));
                }}
                placeholder={field.placeholder}
                className={`mt-1 block w-full rounded border px-3 py-2 ${
                  errors[field.name] ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            )}

            {errors[field.name] && (
              <p className="text-red-600 text-sm mt-1">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-4 justify-end mt-8">
        <button
          type="button"
          onClick={resetForm}
          disabled={isSubmitting}
          className="px-6 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Submitting...
            </>
          ) : (
            'Submit Evaluation'
          )}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// COMPONENT 3: Results Display with Charts
// ============================================================================

export function EvaluationResults({
  diagnosticId,
  token
}: {
  diagnosticId: string;
  token: string;
}) {
  const { diagnostic, loading, error } = useDiagnosticDetail(diagnosticId, token);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading diagnostic details...</span>
      </div>
    );
  }

  if (error || !diagnostic) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error loading diagnostic</p>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  const probabilities = [
    {
      name: 'Preeclampsia',
      value: Math.round(diagnostic.condition_probabilities.preeclampsia.probability * 100)
    },
    {
      name: 'GDM',
      value: Math.round(diagnostic.condition_probabilities.gdm.probability * 100)
    },
    {
      name: 'Preterm Birth',
      value: Math.round(diagnostic.condition_probabilities.preterm_birth.probability * 100)
    }
  ];

  const shapeFeatures = diagnostic.explainability_data.features.slice(0, 5).map(f => ({
    name: f.feature,
    importance: Math.round(f.importance * 100),
    contribution: Math.round(f.contribution * 100)
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{diagnostic.patient_name} - Evaluation Results</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-gray-600 text-sm">Primary Risk</p>
          <p className="text-2xl font-bold text-red-600">
            {DISEASE_DISPLAY_NAMES[diagnostic.dominant_condition]}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-gray-600 text-sm">Overall Severity</p>
          <p className="text-2xl font-bold text-orange-600">
            {(diagnostic.overall_severity_score * 100).toFixed(0)}%
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-gray-600 text-sm">Model Used</p>
          <p className="text-lg font-semibold">{diagnostic.model_used.split(' |')[0]}</p>
        </div>
      </div>

      {/* Probability Pie Chart */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Disease Probabilities</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={probabilities}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {probabilities.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={Object.values(DISEASE_COLORS)[index]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* SHAP Feature Importance */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Key Risk Factors (SHAP Analysis)</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={shapeFeatures}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="importance" fill="#06b6d4" name="Importance (%)" />
            <Bar dataKey="contribution" fill="#f59e0b" name="Contribution (%)" />
          </BarChart>
        </ResponsiveContainer>

        {/* Feature Details */}
        <div className="mt-6 space-y-3">
          {diagnostic.explainability_data.features.map((feature, i) => (
            <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{feature.feature}</p>
                  <p className="text-sm text-gray-600">{feature.clinical_hint}</p>
                </div>
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {(feature.importance * 100).toFixed(0)}% important
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Data Summary */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Input Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(formatEvaluationData({
            ...diagnostic.biomarkers,
            ...diagnostic.metabolomics,
            ...diagnostic.doppler,
            ...diagnostic.disease_specific_inputs,
            patient_id: diagnostic.patient_id,
            stage1_screening_id: diagnostic.stage1_screening_id,
            gestational_age_weeks: diagnostic.gestational_age_weeks,
            age: 0,
            ffn_result: false,
            pregnancies_count: 0
          })).map(([key, value]) => (
            <div key={key}>
              <p className="text-gray-600">{key}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end mt-8">
        <button className="px-6 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">
          Print Report
        </button>
        <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Schedule Follow-up
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE: Main Specialist Portal Component
// ============================================================================

export function SpecialistPortal({ token }: { token: string }) {
  const [activeTab, setActiveTab] = useState<'pending' | 'evaluate' | 'history'>('pending');

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-4xl font-bold">Specialist Diagnostic Portal</h1>
          <p className="text-gray-600 mt-2">Maternal health risk assessment and differential diagnosis</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2 rounded font-semibold ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Pending Evaluations
          </button>
          <button
            onClick={() => setActiveTab('evaluate')}
            className={`px-6 py-2 rounded font-semibold ${
              activeTab === 'evaluate'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            New Evaluation
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'pending' && <SpecialistPendingList token={token} />}
          {activeTab === 'evaluate' && (
            <div className="text-center text-gray-600">
              <p>Select a patient from Pending Evaluations to begin diagnostic entry</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecialistPortal;
