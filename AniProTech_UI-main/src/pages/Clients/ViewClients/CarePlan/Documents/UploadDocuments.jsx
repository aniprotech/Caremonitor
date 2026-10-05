import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import useScrollToTop from '../../../../../hooks/useScrollToTop';
import ConfirmationDialog from '../../../../../components/shared/ConfirmationDialog';
import DataTable from 'react-data-table-component';
import { customStyles } from '../../../../../data/clients/clientVisitConstantData';
import APIConfig from '../../../../../utils/ApiConfig';
import { _get, _postForm, _delete, _put } from '../../../../../utils/ApiService';
import { clientCarePlanDocuments } from '../../../../../data/clients/clientCarePlanData';
import { showError, showSuccess } from '../../../../../utils/toaster';

const UploadDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, docId: null });
  const fileInputRef = useRef();
  const { id: clientId } = useParams();
  const BASE_URL = (import.meta.env.VITE_APP_BASE_LIVE_URL || "https://backend.aniprotech.com").replace(/\/$/, "");

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await _get(APIConfig.CLIENT_CARE_PLAN_FILES.GET_ALL(clientId));
      setDocuments(res?.data?.results?.data || []);
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to fetch documents');
    }
  };

  const handleFiles = async (files) => {
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        showError(`File type not allowed: ${file.name}`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', file.type);
      formData.append('readAccessToCareGivers', false);
      formData.append('clientId', clientId);

      try {
        const response = await _postForm(APIConfig.CLIENT_CARE_PLAN_FILES.UPLOAD_DOCUMENT(), formData);
        showSuccess(response?.data?.message);
        fetchDocuments();
      } catch (error) {
        showError(error?.response?.data?.message || 'Failed to upload document');
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };



  const handleDownload = (doc) => {
    const viewableTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    const fileUrl = `${BASE_URL}/${doc.fileUrl}`;
  
    console.log('Resolved file URL:', fileUrl);
  
    if (viewableTypes.includes(doc.fileType)) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', doc.fileName || 'download');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  

  const handleDelete = async (id) => {
    try {
      const response = await _delete(APIConfig.CLIENT_CARE_PLAN_FILES.DELETE(id));
      setDeleteDialog({ isOpen: false, docId: null });
      showSuccess(response?.data?.message);
      fetchDocuments();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete document');
    }
  };
  

  const toggleReadAccess = async (docId, newValue) => {
    try {
      const response = await _put(APIConfig.CLIENT_CARE_PLAN_FILES.UPDATE(docId), {
        readAccessToCareGivers: newValue,
      });
      showSuccess(response?.data?.message);
      fetchDocuments();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to update read access');
    }
  };

  useScrollToTop();



  return (
    <div className="bg-[#f8fafe] min-h-screen p-6 md:p-12 text-sm text-[#1a1a1a] font-inter">
      <div className="max-w-4xl mx-auto">
        <Link to={-1} className="flex items-center text-customTextLightNavy mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Back</span>
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl px-6 py-8 shadow-sm">
          <h1 className="text-xl poppins-medium text-customBlack">Upload documents</h1>
          <p className="text-[#666] mt-1">Drag and drop any documents relating to this client that you would like to save.</p>

          <div className="flex items-start bg-[#fffef5] border border-gray-300 p-4 rounded mt-6">
            <span className="text-customDarkYellow mr-3">⚠</span>
            <p className="text-customDarkYellow">
              Permissions can be set to display PDFs, JPGs and PNGs to carers in the app. Other formats cannot be shared with the carer app currently.
            </p>
          </div>

          <div
            className={`mt-6 rounded-md border-2 p-12 border-dashed transition-all duration-200 ${
              isDragOver ? 'border-[#285bc7] bg-white' : 'border-[#d3dce6] bg-[#fefefe]'
            } text-center cursor-pointer`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current.click()}
          >
            <Upload className="w-8 h-8 text-[#b0b0b0] mx-auto mb-3" />
            <p className="text-[#666] text-sm">Drag and drop or click and select a file</p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </div>

          {documents.length > 0 && (
            <div className="mt-8 border p-3 border-[#e5e7eb] overflow-hidden">
              <DataTable
                columns={clientCarePlanDocuments(handleDownload, toggleReadAccess, setDeleteDialog)}
                data={documents}
                customStyles={customStyles}
                pagination={false}
                noHeader
                sortIcon={<span className="opacity-50">▼</span>}
              />
            </div>
          )}
        </div>

        <ConfirmationDialog
          isOpen={deleteDialog.isOpen}
          onClose={() => setDeleteDialog({ isOpen: false, docId: null })}
          onConfirm={() => handleDelete(deleteDialog.docId)}
          title="Are you sure you want to delete this file?"
        />
      </div>
    </div>
  );
};

export default UploadDocuments;
