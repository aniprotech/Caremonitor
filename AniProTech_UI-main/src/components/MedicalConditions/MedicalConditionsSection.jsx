import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import MedicalConditionCard from './MedicalConditionCard';
import EditMedicalConditionDialog from './EditMedicalConditionDialog';
import AssessmentFormField from '../FormFields/AssessmentFormField';

const MedicalConditionsSection = ({ 
    clientId, 
    clientName,
    questions,
    onUpdateCondition,
    onDeleteCondition 
}) => {
    const [conditions, setConditions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingCondition, setEditingCondition] = useState(null);

    useEffect(() => {
        fetchMedicalConditions();
    }, [clientId]);

    const fetchMedicalConditions = async () => {
        try {
            setLoading(true);
            // Replace with your actual API endpoint
            const response = await fetch(`/api/clients/${clientId}/medical-conditions`);
            if (!response.ok) throw new Error('Failed to fetch medical conditions');
            const data = await response.json();
            setConditions(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (condition) => {
        setEditingCondition(condition);
    };

    const handleSave = async (updatedCondition) => {
        try {
            // Call the parent's update handler
            await onUpdateCondition(updatedCondition);
            
            // Update local state
            setConditions(conditions.map(c => 
                c.id === updatedCondition.id ? updatedCondition : c
            ));
            
            setEditingCondition(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (condition) => {
        if (!window.confirm('Are you sure you want to delete this condition?')) return;

        try {
            // Call the parent's delete handler
            await onDeleteCondition(condition.id);
            
            // Update local state
            setConditions(conditions.filter(c => c.id !== condition.id));
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading medical conditions...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Medical conditions</h2>
                <p className="text-gray-600">Record how {clientName}'s medical conditions affect them.</p>
                
                {/* Existing conditions */}
                <div className="space-y-4">
                    {conditions.map(condition => (
                        <MedicalConditionCard
                            key={condition.id}
                            condition={condition}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            </div>

            {/* Other medical assessment questions */}
            <div className="space-y-4">
                {questions.map(question => (
                    <AssessmentFormField
                        key={question.id}
                        field={question}
                        clientName={clientName}
                    />
                ))}
            </div>

            {/* Edit dialog */}
            {editingCondition && (
                <EditMedicalConditionDialog
                    condition={editingCondition}
                    onClose={() => setEditingCondition(null)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

MedicalConditionsSection.propTypes = {
    clientId: PropTypes.string.isRequired,
    clientName: PropTypes.string.isRequired,
    questions: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        subtitle: PropTypes.string,
        answer_type: PropTypes.object.isRequired,
    })).isRequired,
    onUpdateCondition: PropTypes.func.isRequired,
    onDeleteCondition: PropTypes.func.isRequired,
};

export default MedicalConditionsSection; 