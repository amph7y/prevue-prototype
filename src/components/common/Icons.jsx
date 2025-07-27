import React from 'react';
import PropTypes from 'prop-types';

const IconPropTypes = {
    className: PropTypes.string,
};

export const CheckIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>);
CheckIcon.propTypes = IconPropTypes;

export const ClipboardIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4-1v4m0 0H8m4 0h4m-4 4v4m0-4h4m-4-4H8m4 4v4m0 0h4" /></svg>);
ClipboardIcon.propTypes = IconPropTypes;

export const SparklesIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2.5a.75.75 0 01.75.75v.255a.75.75 0 01-1.5 0V3.25A.75.75 0 0110 2.5zM8.006 4.006a.75.75 0 00-1.06 1.06l-.07.071a.75.75 0 001.06 1.06l.07-.07a.75.75 0 00-1.06-1.061l-.07.07zM12.006 4.006a.75.75 0 00-1.06-1.06l-.07.07a.75.75 0 001.06 1.06l.07-.071a.75.75 0 00-1.06-1.06l-.07-.07zM2.5 10a.75.75 0 01.75-.75h.255a.75.75 0 010 1.5H3.25A.75.75 0 012.5 10zM17.5 10a.75.75 0 01.75-.75h.255a.75.75 0 010 1.5H18.25a.75.75 0 01-.75-.75zM11.994 15.994a.75.75 0 001.06-1.06l.07-.071a.75.75 0 00-1.06-1.06l-.07.07a.75.75 0 001.06 1.061l-.07-.07zM8.006 15.994a.75.75 0 001.06 1.06l.07-.07a.75.75 0 00-1.06-1.06l-.07.071a.75.75 0 001.06-1.06l.07.07zM10 17.5a.75.75 0 01-.75-.75v-.255a.75.75 0 011.5 0V16.75A.75.75 0 0110 17.5zM4.22 5.29a.75.75 0 010 1.06l-1.47 1.47a.75.75 0 11-1.06-1.06l1.47-1.47a.75.75 0 011.06 0zM15.78 5.29a.75.75 0 011.06 0l1.47 1.47a.75.75 0 11-1.06 1.06l-1.47-1.47a.75.75 0 010-1.06zM4.22 14.71a.75.75 0 011.06 0l-1.47 1.47a.75.75 0 11-1.06-1.06l1.47-1.47zM15.78 14.71a.75.75 0 010 1.06l1.47 1.47a.75.75 0 11-1.06-1.06l-1.47-1.47a.75.75 0 011.06 0z" clipRule="evenodd" /></svg>);
SparklesIcon.propTypes = IconPropTypes;

export const PlusCircleIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
PlusCircleIcon.propTypes = IconPropTypes;

export const MinusCircleIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
MinusCircleIcon.propTypes = IconPropTypes;

export const SearchIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>);
SearchIcon.propTypes = IconPropTypes;

export const KeyIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>);
KeyIcon.propTypes = IconPropTypes;

export const BookOpenIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>);
BookOpenIcon.propTypes = IconPropTypes;

export const XCircleIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
XCircleIcon.propTypes = IconPropTypes;

export const MainSparklesIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M19 3v4M17 5h4M12 2v4M10 4h4M5 21v-4M3 19h4M19 21v-4M17 19h4M12 22v-4M10 20h4M9.5 9.5l1-1 1 1M13.5 13.5l1-1 1 1M9.5 14.5l1 1 1-1M13.5 9.5l1 1 1-1" /></svg>);
MainSparklesIcon.propTypes = IconPropTypes;

export const ArrowUturnLeftIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>);
ArrowUturnLeftIcon.propTypes = IconPropTypes;

export const ArrowUturnRightIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>);
ArrowUturnRightIcon.propTypes = IconPropTypes;

export const ArrowPathIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l4.992-4.993m-4.993 0l-3.181 3.183a8.25 8.25 0 000 11.664l3.181 3.183" /></svg>);
ArrowPathIcon.propTypes = IconPropTypes;

export const DocumentDuplicateIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m9.375 0a9.06 9.06 0 00-1.5-.124M9.375 7.875c0-6.023 4.828-10.875 10.875-10.875h.375c.621 0 1.125.504 1.125 1.125v15.25a1.125 1.125 0 01-1.125 1.125h-3.375m-13.5-9.25V7.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v13.5a1.125 1.125 0 01-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125v-3.375" /></svg>);
DocumentDuplicateIcon.propTypes = IconPropTypes;

export const ArrowTopRightOnSquareIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>);
ArrowTopRightOnSquareIcon.propTypes = IconPropTypes;

export const FolderPlusIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>);
FolderPlusIcon.propTypes = IconPropTypes;

export const HomeIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>);
HomeIcon.propTypes = IconPropTypes;

export const ClockIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
ClockIcon.propTypes = IconPropTypes;

export const ArrowPathRoundedSquareIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l4.992-4.993m-4.993 0l-3.181 3.183a8.25 8.25 0 000 11.664l3.181 3.183M4.5 12.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H5.25a.75.75 0 01-.75-.75z" /></svg>);
ArrowPathRoundedSquareIcon.propTypes = IconPropTypes;

export const DocumentTextIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>);
DocumentTextIcon.propTypes = IconPropTypes;

export const LightBulbIcon = ({ className }) => (<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-11.25H10.5a6.01 6.01 0 001.5 11.25v5.25m0 0V21m0-3h-1.5m1.5 0h1.5M12 6.75v.008" /></svg>);
LightBulbIcon.propTypes = IconPropTypes;