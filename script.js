
'use strict';

let currentType = 'all';
// Read type from URL if exists
const params = new URLSearchParams(window.location.search);
const type = params.get('type');

if (type) {
    currentType = type;
}
let currentDateRange = '';
let currentDateMode = 'preset';
let customStartDate = '';
let customEndDate = '';
let apiSearchKeys = [];

// API filter options storage
let apiPaymentStatuses = [];
let apiTaxCategories = [];
let apiattachementsLabels = [];
let apiCarryForwardStatuses = [];
let apiSentStatuses = [];
let apiListedStatuses = [];
let apiDocumentTypes = [];
let apiTaxCategoryTypes = [];

let lastApiResponse = null;

const bodyDirection = document.body.style.direction;
console.log(bodyDirection);

async function fetchVatDeclarationDetails(type = null, dateRange = null, customStart = null, customEnd = null,
    groupBy = null, searchKey = null, searchQuery = null) {
    try {
        // Build URL
        const id = 1; // or dynamic value
        const locale = "ar";
        const urlTemplate = `https://foo.thevalue.sa/${locale}/admin/settings/vat-declaration-details-data/${id}`;
        console.log(urlTemplate);

        const urlString = urlTemplate.replace(':id', id);
        const url = new URL(urlString);
        url.searchParams.set('page', '1');

        // ✅ Read searchKey and searchQuery from URL parameters if not provided
        if (!searchKey || !searchQuery) {
            const currentUrl = new URL(window.location.href);
            const urlSearchKey = currentUrl.searchParams.get('keywordFilters[0][type]');
            const urlSearchQuery = currentUrl.searchParams.get('keywordFilters[0][query]');

            if (urlSearchKey && urlSearchQuery) {
                searchKey = urlSearchKey;
                searchQuery = urlSearchQuery;
            }
        }

        // Handle type state
        if (type !== null) {
            currentType = type;
            // Sync with existing app state variable if it exists
            if (typeof currentVATMode !== 'undefined') currentVATMode = type;
        } else {
            // ✅ Read type from URL if not provided
            const currentUrl = new URL(window.location.href);
            const urlType = currentUrl.searchParams.get('type');
            if (urlType && !currentType) {
                currentType = urlType;
                if (typeof currentVATMode !== 'undefined') currentVATMode = urlType;
            }
        }
        url.searchParams.set('type', (currentType && currentType !== 'all') ? currentType : 'all');

        // Determine Mode and Params
        if (dateRange !== null) {
            // Switched to preset
            currentDateMode = 'preset';
            currentDateRange = dateRange;
            // Clear custom dates
            customStartDate = '';
            customEndDate = '';
        } else if (customStart !== null && customEnd !== null) {
            // Switched to custom
            currentDateMode = 'custom';
            customStartDate = customStart;
            customEndDate = customEnd;
            // Clear preset
            currentDateRange = '';
        }

        if (currentDateMode === 'preset') {
            if (currentDateRange) {
                url.searchParams.set('date_range', currentDateRange);
            }
            // Ensure start/end are removed/not sent
            url.searchParams.delete('start_date');
            url.searchParams.delete('end_date');
        } else if (currentDateMode === 'custom') {
            if (customStartDate && customEndDate) {
                url.searchParams.set('start_date', customStartDate);
                url.searchParams.set('end_date', customEndDate);
            }
            // Ensure date_range is removed/not sent
            url.searchParams.delete('date_range');
        }

        if (groupBy) {
            url.searchParams.set('group_by', groupBy);
        }

        // Clear previous keyword filters from URL
        for (const [key] of url.searchParams.entries()) {
            if (key.startsWith('keywordFilters[')) {
                url.searchParams.delete(key);
            }
        }

        let filterIdx = 0;

        // Add Main Search Input if active
        const searchInput = document.getElementById('searchInput');
        let queryVal = searchInput?.value?.trim() || '';

        if (queryVal && activeSearchScope && activeSearchScope !== 'all') {
            url.searchParams.set(`keywordFilters[${filterIdx}][type]`, activeSearchScope);
            url.searchParams.set(`keywordFilters[${filterIdx}][query]`, queryVal);
            filterIdx++;
        } else if (queryVal) {
            url.searchParams.set('search', queryVal);
        }

        // Add Column Filters
        const columnKeyToApiMap = {
            attachments: 'attachment',
            notes: 'note',
            taxCategory: 'tax_category',
            paymentStatus: 'payment_status',
            postingStatus: 'carry_forward_status',
            zatcaStatus: 'sent_status',
            vatReturn: 'listed_status',
            docNo: 'document_number',
            docType: 'document_type',
            reference: 'reference',
            taxCode: 'tax_code'
        };

        Object.keys(columnFilters).forEach(colKey => {
            const vals = columnFilters[colKey];
            if (Array.isArray(vals) && vals.length > 0) {
                const apiType = columnKeyToApiMap[colKey] || colKey;
                const apiVal = vals.join(',');
                url.searchParams.set(`keywordFilters[${filterIdx}][type]`, apiType);
                url.searchParams.set(`keywordFilters[${filterIdx}][query]`, apiVal);
                filterIdx++;
            }
        });

        // Add additional filter from parameters if provided
        if (searchKey && searchQuery) {
            url.searchParams.set(`keywordFilters[${filterIdx}][type]`, searchKey);
            url.searchParams.set(`keywordFilters[${filterIdx}][query]`, searchQuery);
            filterIdx++;
        }

        console.log(url.toString());
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(data);

        renderTable(data);

        // Handle Search Keys
        if (data.searchKeys && Array.isArray(data.searchKeys)) {
            apiSearchKeys = data.searchKeys;
            renderSearchScopeOptions();
        }

        // Handle Filter Options from API
        if (data.paymentStatuses && Array.isArray(data.paymentStatuses)) {
            apiPaymentStatuses = data.paymentStatuses;
        }
        if (data.taxCategoryTypeLabels && Array.isArray(data.taxCategoryTypeLabels)) {
            apiTaxCategories = data.taxCategoryTypeLabels;
        }
        if (data.attachment && Array.isArray(data.attachment)) {
            apiattachementsLabels = data.attachment;
        }
        if (data.carryForwardStatus && Array.isArray(data.carryForwardStatus)) {
            apiCarryForwardStatuses = data.carryForwardStatus;
        }
        if (data.sentStatuses && Array.isArray(data.sentStatuses)) {
            apiSentStatuses = data.sentStatuses;
        }
        if (data.listedStatus && Array.isArray(data.listedStatus)) {
            apiListedStatuses = data.listedStatus;
        }
        if (data.document_types && Array.isArray(data.document_types)) {
            apiDocumentTypes = data.document_types;
            populateNestedFilterOptions('docType', apiDocumentTypes);
        }
        if (data.taxCategoryTypeLabels && Array.isArray(data.taxCategoryTypeLabels)) {
            apiTaxCategoryTypes = data.taxCategoryTypeLabels;
            populateNestedFilterOptions('taxCategory', apiTaxCategoryTypes);
        }

        updateSearchFilterButtonState();

        // Update date headers and inputs
        if (data.start_date && data.end_date) {
            // Update Header Dates
            const headerDateFrom = document.getElementById('headerDateFrom');
            if (headerDateFrom) headerDateFrom.textContent = data.start_date;

            const headerDateTo = document.getElementById('headerDateTo');
            if (headerDateTo) headerDateTo.textContent = data.end_date;

            // Update Hidden Inputs
            const dateFromInput = document.getElementById('dateFrom');
            if (dateFromInput) dateFromInput.value = data.start_date;

            const dateToInput = document.getElementById('dateTo');
            if (dateToInput) dateToInput.value = data.end_date;

            // Update Display Spans
            const displayDateFrom = document.getElementById('displayDateFrom');
            if (displayDateFrom) displayDateFrom.textContent = data.start_date;

            const displayDateTo = document.getElementById('displayDateTo');
            if (displayDateTo) displayDateTo.textContent = data.end_date;

            // Update Flatpickr / Range Picker Display
            const dateRangePickerEl = document.getElementById('dateRangePicker');
            if (dateRangePickerEl) {
                dateRangePickerEl.value = `${data.start_date} → إلى: ${data.end_date}`;
            }

            // Update picker instance if in preset mode
            if (currentDateMode === 'preset') {
                if (typeof dateRangePicker !== 'undefined' && dateRangePicker && typeof dateRangePicker
                    .setDate === 'function') {
                    dateRangePicker.setDate([data.start_date, data.end_date], false);
                }
            }
        }

        // Render VAT Mode Pills/Tabs
        if (data.types && Array.isArray(data.types)) {
            const container = document.querySelector('.vat-modes');
            if (container) {
                container.innerHTML = '';
                data.types.forEach(t => {
                    const btn = document.createElement('button');
                    const isActive = t.value === currentType;
                    btn.className = `mode-pill ${isActive ? 'active' : ''}`;
                    btn.dataset.mode = t.value;
                    btn.type = 'button';
                    btn.role = 'tab';
                    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    btn.textContent = t.label;

                    btn.onclick = () => {
                        fetchVatDeclarationDetails(t.value, null);
                    };

                    container.appendChild(btn);
                });
            }
        }

        // Generate Dynamic Date Presets
        if (data.dates && Array.isArray(data.dates)) {
            const menu = document.getElementById('quickDatesMenu');
            if (menu) {
                menu.innerHTML = '';
                data.dates.forEach(d => {
                    const item = document.createElement('div');
                    item.dataset.preset = d.value;
                    item.style.cssText = `
                        padding: 10px 14px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        border-bottom: 1px solid var(--vp-border-light);
                        transition: all 0.2s;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    `;

                    item.onmouseover = () => item.style.background = 'var(--vp-bg-hover)';
                    item.onmouseout = () => {
                        if (currentDateRange !== d.value) item.style.background = 'white';
                    };

                    const label = document.createElement('span');
                    label.textContent = d.label;

                    const check = document.createElement('span');
                    check.className = 'check-mark';
                    check.textContent = '✓';
                    check.style.cssText = `
                        color: var(--vp-accent);
                        font-weight: 900;
                        opacity: ${currentDateRange === d.value ? '1' : '0'};
                    `;

                    item.appendChild(label);
                    item.appendChild(check);

                    item.onclick = () => {
                        fetchVatDeclarationDetails(null, d.value);
                        const quickDatesMenu = document.getElementById('quickDatesMenu');
                        if (quickDatesMenu) quickDatesMenu.style.display = 'none';
                    };

                    menu.appendChild(item);
                });
            }
        }

        // Update KPI Summary
        const totalSales = (typeof data.total_sales_vat !== 'undefined') ? data.total_sales_vat : (data
            .summary && data.summary.total_sales_vat);
        const totalPurchase = (typeof data.total_purchase_vat !== 'undefined') ? data.total_purchase_vat : (data
            .summary && data.summary.total_purchase_vat);
        const totalNet = (typeof data.total_net_vat_due !== 'undefined') ? data.total_net_vat_due : (data
            .summary && data.summary.total_net_vat_due);
        const currency = data.currency || (data.summary && data.summary.currency) || 'ريال';

        const kpiOutput = document.getElementById('kpi-output-vat');
        if (kpiOutput) kpiOutput.textContent = (typeof totalSales !== 'undefined' ? totalSales : 0);

        const kpiInput = document.getElementById('kpi-input-vat');
        if (kpiInput) kpiInput.textContent = (typeof totalPurchase !== 'undefined' ? totalPurchase : 0);

        const kpiNet = document.getElementById('kpi-net-vat');
        if (kpiNet) kpiNet.textContent = (typeof totalNet !== 'undefined' ? totalNet : 0);

        // Update units
        document.querySelectorAll('.kpi-unit').forEach(el => {
            el.textContent = currency;
        });

        // Populate Group By dropdown if data exists
        if (data.groupedBy && Array.isArray(data.groupedBy)) {
            populateGroupByDropdown(data.groupedBy);
        }

        // Refresh local table filtering
        if (typeof applyFilters === 'function') {
            applyFilters({
                resetPage: true
            });
        }

        // Save state if needed (using existing saveState function)
        if (typeof saveState === 'function') {
            saveState();
        }

    } catch (error) {
        console.error('Error fetching VAT declaration details:', error);
    }
}

// ==================== GROUP BY DROPDOWN ====================

let groupByOptions = [];
let selectedGroupBy = null;

function populateGroupByDropdown(options) {
    groupByOptions = options;
    const container = document.getElementById('groupByOptions');
    if (!container) return;

    container.innerHTML = '';

    options.forEach(option => {
        const isSelected = selectedGroupBy === option.value;

        const optionDiv = document.createElement('div');
        optionDiv.className = `group-by-option ${isSelected ? 'selected' : ''}`;
        optionDiv.onclick = () => selectGroupBy(option.value);

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'groupBy';
        radio.value = option.value;
        radio.checked = isSelected;
        radio.onchange = () => selectGroupBy(option.value);

        const label = document.createElement('label');
        label.textContent = option.label;
        label.onclick = (e) => {
            e.stopPropagation();
            selectGroupBy(option.value);
        };

        optionDiv.appendChild(radio);
        optionDiv.appendChild(label);
        container.appendChild(optionDiv);
    });
}

function toggleGroupByDropdown(event) {
    if (event) event.stopPropagation();

    const dropdown = document.getElementById('groupByDropdown');
    if (!dropdown) return;

    const isActive = dropdown.classList.contains('active');

    // Close all other dropdowns
    closeAllDropdowns();

    // Toggle this dropdown
    dropdown.classList.toggle('active', !isActive);
}

function selectGroupBy(value) {
    selectedGroupBy = value;

    // Update visual selection
    const options = document.querySelectorAll('.group-by-option');
    options.forEach(opt => {
        const radio = opt.querySelector('input[type="radio"]');
        const isSelected = radio && radio.value === value;
        opt.classList.toggle('selected', isSelected);
        if (radio) radio.checked = isSelected;
    });

    // Close dropdown
    const dropdown = document.getElementById('groupByDropdown');
    if (dropdown) dropdown.classList.remove('active');

    // Update URL and fetch data
    fetchVatDeclarationDetails(null, null, null, null, value);
}

function closeAllDropdowns() {
    // Close smart search dropdown
    const smartSearch = document.getElementById('smartSearchDropdown');
    if (smartSearch) smartSearch.classList.remove('active');

    // Close group by dropdown
    const groupBy = document.getElementById('groupByDropdown');
    if (groupBy) groupBy.classList.remove('active');

    // Close other dropdowns
    closeMenu();
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const groupByContainer = document.querySelector('.group-by-container');
    const smartSearchContainer = document.querySelector('.smart-search-container');
    const filterByContainer = document.querySelector('.filter-by-container');

    if (groupByContainer && !groupByContainer.contains(e.target)) {
        const dropdown = document.getElementById('groupByDropdown');
        if (dropdown) dropdown.classList.remove('active');
    }

    if (filterByContainer && !filterByContainer.contains(e.target)) {
        const dropdown = document.getElementById('filterByDropdown');
        if (dropdown) dropdown.classList.remove('active');
    }

    if (smartSearchContainer && !smartSearchContainer.contains(e.target)) {
        const dropdown = document.getElementById('smartSearchDropdown');
        if (dropdown) dropdown.classList.remove('active');
    }
});

// ==================== FILTER BY DROPDOWN ====================

function toggleFilterByDropdown(event) {
    if (event) event.stopPropagation();

    const dropdown = document.getElementById('filterByDropdown');
    if (!dropdown) return;

    const isActive = dropdown.classList.contains('active');

    closeAllDropdowns();

    dropdown.classList.toggle('active', !isActive);


}

// Nested Filter State
let openNestedFilter = null;
let selectedDocTypeFilter = null;
let selectedTaxCategoryFilter = null;

function toggleNestedFilter(filterType) {
    const optionsContainer = document.getElementById(`${filterType}Options`);
    const arrow = document.getElementById(`${filterType}Arrow`);

    if (!optionsContainer || !arrow) return;

    const isCurrentlyOpen = openNestedFilter === filterType;

    // Close all nested filters first
    document.querySelectorAll('.filter-nested-options').forEach(opt => {
        opt.style.display = 'none';
    });
    document.querySelectorAll('.filter-arrow').forEach(arr => {
        arr.textContent = '◀';
        arr.style.transform = 'rotate(0deg)';
    });

    // If clicking on a different filter or opening for first time
    if (!isCurrentlyOpen) {
        optionsContainer.style.display = 'block';
        arrow.textContent = '▼';
        arrow.style.transform = 'rotate(0deg)';
        openNestedFilter = filterType;
    } else {
        openNestedFilter = null;
    }
}

function populateNestedFilterOptions(filterType, options) {
    const container = document.getElementById(`${filterType}Options`);
    if (!container || !options || !Array.isArray(options)) return;

    container.innerHTML = '';

    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'filter-nested-option';
        optionDiv.textContent = option.label;
        optionDiv.onclick = () => selectNestedFilter(filterType, option.value, option.label);

        // Highlight if this option is currently selected
        if ((filterType === 'docType' && selectedDocTypeFilter === option.value) ||
            (filterType === 'taxCategory' && selectedTaxCategoryFilter === option.value)) {
            optionDiv.classList.add('selected');
        }

        container.appendChild(optionDiv);
    });
}

function selectNestedFilter(filterType, value, label) {
    // Update selection state
    if (filterType === 'docType') {
        selectedDocTypeFilter = value;
        // Call API with document_type filter
        fetchVatDeclarationDetails(null, null, null, null, null, 'document_type', value);
    } else if (filterType === 'taxCategory') {
        selectedTaxCategoryFilter = value;
        // Call API with tax category filter
        fetchVatDeclarationDetails(null, null, null, null, null, 'tax_category', value);
    }


    // Update visual selection
    const container = document.getElementById(`${filterType}Options`);
    if (container) {
        container.querySelectorAll('.filter-nested-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        event.target.classList.add('selected');
    }

    // Close the dropdown
    const dropdown = document.getElementById('filterByDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }

    console.log(`Selected ${filterType}: ${value} (${label})`);
}

function renderSearchScopeOptions() {
    const select = document.getElementById('searchScopeSelect');
    if (!select) return;

    // Save current selection if possible
    const currentVal = select.value;

    select.innerHTML = '';

    apiSearchKeys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.value;
        opt.textContent = k.label;
        select.appendChild(opt);
    });

    // Restore selection if it exists in new keys, else default to first option
    const exists = apiSearchKeys.find(k => k.value === currentVal);

    if (exists) {
        select.value = currentVal;
    } else if (apiSearchKeys.length > 0) {
        select.value = apiSearchKeys[0].value;
    }

    // Update active scope to match
    activeSearchScope = select.value;
    updateSearchPlaceholder();
}

// API data storage
let apiVatData = [];
let apiSummary = {};

// Transform API response to match expected format
function transformApiData(apiResponse) {
    if (!apiResponse || !apiResponse.data) return [];

    return apiResponse.data.map(item => {
        // Extract first tax code and rate
        const taxCode = Array.isArray(item.tax_codes) && item.tax_codes.length > 0 ? item.tax_codes.join(
            ' - ') : '';
        const rateStr = Array.isArray(item.tax_rates) && item.tax_rates.length > 0 ?
            item.tax_rates.map(rate => {
                const num = Number(rate);
                return !isNaN(num) ? num + '%' : '0%';
            }).join(' - ') :
            '0%';
        const rate = rateStr;

        // Map account names
        const accountName = Array.isArray(item.acount_name) && item.acount_name.length > 0 ?
            item.acount_name
                .filter(name => name && name.trim() !== '') // Remove empty/null entries
                .join(' - ') :
            '';
        // Determine tax type from tax_type array
        const taxTypeRaw = Array.isArray(item.tax_type) && item.tax_type.length > 0 ? item.tax_type.join(
            ' - ') : '';
        const taxType = taxTypeRaw;

        // Map payment status
        const paymentStatus = item.payment_status;
        const paymentStatusLabel = item.payment_status || 'غير مدفوع';

        // Map ZATCA status
        let zatcaStatus = item.is_sent_to_tax_zakat;

        // Map VAT return status
        let vatReturn = item.vat_declaration

        // Map posting status from carry_forward_status
        let postingStatus = 'draft';
        if (item.carry_forward_status === 'قيد الانتظار') postingStatus = 'posted';

        // Transform details/items
        const items = Array.isArray(item.details) ? item.details.map(detail => ({
            name: detail.item_name || '',
            sku: '',
            account: detail.account_name || '',
            type: detail.type || '',
            taxCode: detail.tax_code || ' ',
            taxRate: detail.tax_rate || '',
            qty: detail.quantity || 0,
            price: detail.base_amount,
            total: detail.total_amount || 0,
            vat: detail.tax_amount || 0
        })) : [];

        return {
            id: item.id,
            date: item.date || '-',
            docNo: item.document || '-',
            docType: item.type,
            revenueAccount: accountName,
            reference: item.reference || '-',
            taxCategory: item.tax_category || '-',
            taxCode: taxCode,
            rate: rate,
            base: item.base_amount || 0,
            vat: item.tax_amount || 0,
            total: item.total_amount || 0,
            taxType: taxType,
            branch: item.project || '-',
            attachments: (item.attachments) || 0,
            notes: item.notes || [],
            notes_count: Array.isArray(item.notes) ? item.notes.length : 0,
            zatcaStatus: zatcaStatus,
            vatReturn: vatReturn,
            postingStatus: item.carry_forward_status,
            createdDate: item.created_at || item.date,
            createdBy: item.created_by || '-',
            paymentStatus: item.payment_status,
            paymentStatusLabel: item.payment_status,
            items: items
        };
    });
}

let normalizedVatData = [];

let filteredData = [...normalizedVatData];
let groupedData = {};
let expandedGroups = {};
let currentVATMode = 'summary';
let currentPage = 1;
let perPage = 20;
let itemsLinesView = 'summary'; // 'summary' | 'detailed'
let collapsedItemDocNos = new Set();
let expandedApiGroups = new Set();

let notesData = {};
let selectedRowIds = new Set();

let activeDocTypeFilter = '';
let activeTaxCategoryFilter = '';
let activePostingStatusFilter = '';
let activePaymentStatusFilter = '';
let activeZatcaStatusFilter = '';
let activeGrouping = 'docType';
let activeSearchScope = ''; // Default to empty/dynamic

// Column Filters
let columnFilters = {};
let activeColumnFilter = null;

// Column visibility
const DEFAULT_COLUMNS = [{
    key: 'expand',
    label: ''
},
{
    key: 'select',
    label: 'تحديد'
},
{
    key: 'date',
    label: 'التاريخ'
},
{
    key: 'createdDate',
    label: 'تاريخ الإنشاء'
},
{
    key: 'docNo',
    label: 'المستند'
},
{
    key: 'docType',
    label: 'النوع'
},
{
    key: 'revenueAccount',
    label: 'اسم الحساب'
},
{
    key: 'reference',
    label: 'المرجع'
},
{
    key: 'taxCategory',
    label: 'تصنيف الضريبة'
},
{
    key: 'taxCode',
    label: 'الكود'
},
{
    key: 'rate',
    label: 'النسبة'
},
{
    key: 'base',
    label: 'المبلغ غير شامل ضريبة'
},
{
    key: 'vat',
    label: 'مبلغ الضريبة'
},
{
    key: 'total',
    label: 'الإجمالي شامل ضريبة'
},
{
    key: 'taxType',
    label: 'نوع الضريبة'
},
{
    key: 'branch',
    label: 'المشروع'
},
{
    key: 'attachments',
    label: 'المرفقات'
},
{
    key: 'notes',
    label: 'ملاحظات'
},
{
    key: 'paymentStatus',
    label: 'حالة السداد'
},
{
    key: 'createdBy',
    label: 'تم الإنشاء بواسطة'
},
{
    key: 'postingStatus',
    label: 'حالة الترحيل'
},
{
    key: 'zatcaStatus',
    label: 'حالة الإرسال للهيئة'
},
{
    key: 'vatReturn',
    label: 'الإقرار الضريبي'
},
{
    key: 'actions',
    label: 'إجراءات'
}
];

let visibleColumns = DEFAULT_COLUMNS.reduce((acc, c) => {
    acc[c.key] = true;
    return acc;
}, {});

function getVisibleKeysInOrder() {
    const showExpand = itemsLinesView === 'detailed';
    const dynamic = DEFAULT_COLUMNS.map(c => c.key).filter((k) => k !== 'expand' && visibleColumns[k] !== false);
    return showExpand ? ['expand', ...dynamic] : dynamic;
}

function rebuildFooterRow(totalBase, totalVat, totalAmount) {
    const table = document.getElementById('vatTable');
    const tfoot = table?.querySelector('tfoot');
    if (!tfoot) return;

    const visibleKeys = getVisibleKeysInOrder();
    const visibleCount = visibleKeys.length || 1;

    const totals = [{
        key: 'base',
        id: 'total-base',
        value: fmt(totalBase)
    },
    {
        key: 'vat',
        id: 'total-vat',
        value: fmt(totalVat)
    },
    {
        key: 'total',
        id: 'total-amount',
        value: fmt(totalAmount)
    }
    ].filter(t => visibleColumns[t.key] !== false);

    const firstTotalKey = totals.length ? totals[0].key : null;
    const totalsStartIdx = firstTotalKey ? visibleKeys.indexOf(firstTotalKey) : -1;

    // Fallback: if totals would start at first column (or none visible),
    // render a single-cell footer that won't break alignment.
    if (totals.length === 0 || totalsStartIdx <= 0) {
        const parts = totals.length ?
            totals.map(t => `${t.key === 'base' ? 'الأساس' : t.key === 'vat' ? 'الضريبة' : 'الإجمالي'}: ${t.value}`)
                .join(' • ') :
            '';
        tfoot.innerHTML = `
 <tr>
 <td colspan="${visibleCount}" style="text-align: right; font-weight: 900;">
 الإجمالي${parts ? ` — ${parts}` : ''}
 </td>
 </tr>
 `;
        return;
    }

    const labelSpan = totalsStartIdx;
    const fillerSpan = Math.max(0, visibleCount - labelSpan - totals.length);

    let html = '<tr>';
    html += `<td colspan="${labelSpan}" style="text-align: right; font-weight: 900;">الإجمالي</td>`;
    totals.forEach(t => {
        html += `<td id="${t.id}" style="font-weight: 900;">${t.value}</td>`;
    });
    if (fillerSpan > 0) html += `<td colspan="${fillerSpan}"></td>`;
    html += '</tr>';

    tfoot.innerHTML = html;
}

// Persistent state
const STORAGE_KEY = 'vp_vat_detailed_report_state_v1';

// Notes persistence
const NOTES_KEY = 'vp_vat_notes_v1';
let notesDataLoaded = false;

async function loadNotesData() {
    if (notesDataLoaded) return;
    notesDataLoaded = true;

    try {

        const response = await fetch("https://foo.thevalue.sa/en/admin/settings/vat/item/notes");


        const data = await response.json();
        console.log(data);
        notesData = data;
    } catch (error) {
        console.error('Error loading notes:', error);
    }

    // Seed with existing sample notes (only if no stored notes for docNo)
    normalizedVatData.forEach(row => {
        if (!row.notes) return;

        // If it's an array of strings/objects
        if (Array.isArray(row.notes) && row.notes.length > 0) {
            if (!notesData[row.docNo] || !Array.isArray(notesData[row.docNo]) || notesData[row.docNo].length === 0) {
                notesData[row.docNo] = row.notes.map(n => {
                    // Handle if n is object or string
                    const txt = (typeof n === 'object' && n !== null && n.text) ? n.text : String(n);
                    return {
                        text: txt,
                        ts: null
                    };
                });
            }
        }
    });
}


function saveNotesData() {
    try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(notesData || {}));
    } catch { }
}

function getNotesForDoc(docNo) {
    loadNotesData();
    const arr = notesData[docNo];
    return Array.isArray(arr) ? arr : [];
}

async function addNoteForDoc(docNo, text, onSuccess, onError) {
    const t = String(text || '').trim();
    if (!t) {
        if (onError) onError({
            message: 'Please enter a note'
        });
        return false;
    }

    try {
        const urlSaveNote = "https://foo.thevalue.sa/en/admin/settings/vat/item/notes";
        const response = await fetch(urlSaveNote, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                doc_no: docNo,
                note_text: t
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            if (onError) {
                onError({
                    message: data.message || 'Failed to add note',
                    errors: data.errors,
                    status: response.status
                });
            }
            return false;
        }

        // Update local cache
        if (!Array.isArray(notesData[docNo])) notesData[docNo] = [];
        notesData[docNo].unshift(data.note);

        if (onSuccess) {
            onSuccess(data);
        }

        return true;

    } catch (error) {
        console.error('Error adding note:', error);
        if (onError) {
            onError({
                message: 'Network error occurred',
                error: error
            });
        }
        return false;
    }
}

// Updated addNoteFromDetails to use callbacks
async function addNoteFromDetails(docNo) {
    const input = document.getElementById('detailsNewNote');
    const val = input?.value ?? '';

    const ok = await addNoteForDoc(
        docNo,
        val,
        // Success callback
        (data) => {
            console.log('Note added successfully:', data);
            if (input) input.value = '';
            renderTable();
            const id = normalizedVatData.find(r => r.docNo === docNo)?.id;
            if (id) openDetailsPanel(id);

            // Optional: Show success message
            showNotification('Note added successfully', 'success');
        },
        // Error callback
        (error) => {
            console.error('Failed to add note:', error);
            showNotification(error.message || 'Failed to add note', 'error');
        }
    );
}

// Optional: Simple notification function
function showNotification(message, type = 'info') {
    // Replace with your preferred notification library
    // Examples: toastr, sweetalert2, bootstrap toast, etc.

    // Simple alert for now
    if (type === 'error') {
        alert('Error: ' + message);
    } else if (type === 'success') {
        console.log('✓ ' + message);
        // You can show a toast here instead
    }
}

let activeNoteEditorDocNo = null;

function toggleNoteEditor(docNo) {
    activeNoteEditorDocNo = (activeNoteEditorDocNo === docNo) ? null : docNo;
    renderTable();
    // Focus input if opened
    if (activeNoteEditorDocNo) {
        setTimeout(() => {
            const el = document.getElementById('noteInput_' + docNo);
            el?.focus();
        }, 0);
    }
}

function cancelNoteEditor() {
    if (!activeNoteEditorDocNo) return;
    activeNoteEditorDocNo = null;
    renderTable();
}

function saveNoteEditor(docNo) {
    const input = document.getElementById('noteInput_' + docNo);
    const val = input?.value ?? '';
    const ok = addNoteForDoc(docNo, val);
    if (!ok) return;
    activeNoteEditorDocNo = null;
    renderTable();
    // Refresh details if open for same doc
    const current = document.getElementById('detailsDocNumber')?.textContent;
    if (current === docNo) openDetailsPanel(normalizedVatData.find(r => r.docNo === docNo)?.id);
}

function saveState() {
    try {
        const state = {
            currentVATMode,
            currentPage,
            perPage,
            activeDocTypeFilter,
            activeTaxCategoryFilter,
            activeGrouping,
            activeSearchScope,
            columnFilters,
            dateFrom: document.getElementById('dateFrom')?.value || '',
            dateTo: document.getElementById('dateTo')?.value || '',
            datePreset: document.getElementById('datePresetSelect')?.value || 'this-year',
            visibleColumns,
            itemsLinesView
        };
        // localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        // ignore
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);

        if (state && typeof state === 'object') {
            if (state.currentVATMode) currentVATMode = state.currentVATMode;
            if (Number.isFinite(state.currentPage)) currentPage = state.currentPage;
            if (Number.isFinite(state.perPage)) perPage = state.perPage;

            if (typeof state.activeDocTypeFilter === 'string') activeDocTypeFilter = state.activeDocTypeFilter;
            if (typeof state.activeTaxCategoryFilter === 'string') activeTaxCategoryFilter = state
                .activeTaxCategoryFilter;
            if (typeof state.activeGrouping === 'string') {
                activeGrouping = (state.activeGrouping === 'none') ? 'docType' : state.activeGrouping;
            }
            if (typeof state.activeSearchScope === 'string') activeSearchScope = state.activeSearchScope;

            if (state.columnFilters && typeof state.columnFilters === 'object') columnFilters = state.columnFilters;

            if (state.visibleColumns && typeof state.visibleColumns === 'object') {
                visibleColumns = {
                    ...visibleColumns,
                    ...state.visibleColumns
                };
            }
            // Remove deleted column state to avoid "hidden" filtering.
            if (visibleColumns && Object.prototype.hasOwnProperty.call(visibleColumns, 'revenueAccount')) {
                delete visibleColumns.revenueAccount;
            }
            if (columnFilters && Object.prototype.hasOwnProperty.call(columnFilters, 'revenueAccount')) {
                delete columnFilters.revenueAccount;
            }

            itemsLinesView = (state.itemsLinesView === 'summary') ? 'summary' : 'detailed';
            visibleColumns.expand = itemsLinesView === 'detailed';

            const dateFromEl = document.getElementById('dateFrom');
            const dateToEl = document.getElementById('dateTo');
            if (dateFromEl && typeof state.dateFrom === 'string' && state.dateFrom) dateFromEl.value = state
                .dateFrom;
            if (dateToEl && typeof state.dateTo === 'string' && state.dateTo) dateToEl.value = state.dateTo;

            const presetEl = document.getElementById('datePresetSelect');
            if (presetEl && typeof state.datePreset === 'string' && state.datePreset) presetEl.value = state
                .datePreset;

            const perPageEl = document.getElementById('perPageSelect');
            if (perPageEl) perPageEl.value = String(perPage);
        }
    } catch (e) {
        // ignore
    }
}

// ==================== MENU ====================
function positionMainMenu(menuEl, btnEl) {
    if (!menuEl || !btnEl) return;

    // Position as fixed so we can clamp within the header "frame"
    const btnRect = btnEl.getBoundingClientRect();
    const frameEl = btnEl.closest('.page-header') || document.querySelector('.content-wrapper') || document.body;
    const frameRect = frameEl.getBoundingClientRect();

    // Use fixed positioning so it never "leaks" outside the template frame.
    menuEl.style.position = 'fixed';
    menuEl.style.right = 'auto';
    menuEl.style.bottom = 'auto';
    menuEl.style.marginTop = '0';
    menuEl.style.marginBottom = '0';

    // Constrain width to the frame to avoid appearing outside the card.
    const padding = 12;
    const maxW = Math.max(200, Math.min(380, frameRect.width - padding * 2));
    menuEl.style.maxWidth = `${maxW}px`;
    menuEl.style.width = '';

    // Measure after any maxWidth changes
    const mRect = menuEl.getBoundingClientRect();
    const menuW = mRect.width;
    const menuH = mRect.height;

    // Horizontal clamp: keep within frame boundaries (RTL-safe).
    const minLeft = frameRect.left + padding;
    const maxLeft = frameRect.right - padding - menuW;
    const desiredRight = Math.min(btnRect.right, frameRect.right - padding);
    let left = desiredRight - menuW;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;
    menuEl.style.left = `${left}px`;

    // Vertical direction: open where there is more space (prefer below).
    const spaceBelow = Math.max(0, window.innerHeight - btnRect.bottom - padding);
    const spaceAbove = Math.max(0, btnRect.top - padding);
    const openBelow = (spaceBelow >= 240) || (spaceBelow >= spaceAbove);

    const availableH = openBelow ? spaceBelow : spaceAbove;
    const maxH = Math.max(180, Math.min(520, availableH));
    menuEl.style.maxHeight = `${maxH}px`;

    let top = openBelow ? (btnRect.bottom + 6) : (btnRect.top - menuH - 6);
    // Clamp to viewport to prevent clipping
    top = Math.max(padding, Math.min(top, window.innerHeight - padding - Math.min(menuH, maxH)));
    menuEl.style.top = `${top}px`;
}

function toggleMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('mainMenu');
    const btn = document.querySelector('.menu-btn-header');
    if (!menu) return;

    const willOpen = !menu.classList.contains('show');
    menu.classList.toggle('show', willOpen);
    if (willOpen) {
        // Wait one frame so the menu has a measurable box.
        requestAnimationFrame(() => positionMainMenu(menu, btn));
    } else {
        // Reset inline positioning so CSS defaults still apply elsewhere.
        menu.style.position = '';
        menu.style.left = '';
        menu.style.top = '';
        menu.style.right = '';
        menu.style.bottom = '';
        menu.style.marginTop = '';
        menu.style.marginBottom = '';
        menu.style.maxHeight = '';
        menu.style.maxWidth = '';
        menu.style.width = '';
    }
}

function closeMenu() {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    closeExportMenu();
    const menu = document.getElementById('mainMenu');
    if (menu) {
        menu.style.position = '';
        menu.style.left = '';
        menu.style.top = '';
        menu.style.right = '';
        menu.style.bottom = '';
        menu.style.marginTop = '';
        menu.style.marginBottom = '';
        menu.style.maxHeight = '';
        menu.style.maxWidth = '';
        menu.style.width = '';
    }
}

function toggleExportMenu(e) {
    if (e) e.stopPropagation();
    const sub = document.getElementById('exportSubmenu');
    const btn = document.getElementById('exportMenuBtn');
    if (!sub) return;
    const willOpen = !sub.classList.contains('show');
    sub.classList.toggle('show', willOpen);
    if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function closeExportMenu() {
    const sub = document.getElementById('exportSubmenu');
    const btn = document.getElementById('exportMenuBtn');
    if (sub) sub.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function refreshData() {
    applyFilters({
        resetPage: false
    });
    alert('تم التحديث');
    closeMenu();
}

function printReport() {
    closeMenu();
    window.print();
}

function exportReportSummary() {
    closeMenu();

    const rows = filteredData;

    // Arabic headers mapping
    const headers = [
        'التاريخ', // date
        'رقم المستند', // docNo
        'نوع المستند', // docType
        'المرجع', // reference
        'تصنيف الضريبة', // taxCategory
        'كود الضريبة', // taxCode
        'النسبة', // rate
        'المبلغ غير شامل ضريبة', // base
        'مبلغ الضريبة', // vat
        'الإجمالي شامل ضريبة', // total
        'نوع الضريبة', // taxType
        'المشروع', // branch
        'المرفقات', // attachments
        'ملاحظات', // notes
        'حالة السداد' // paymentStatusLabel
    ];

    // Field keys (same order as headers)
    const fields = [
        'date', 'docNo', 'docType', 'reference', 'taxCategory', 'taxCode', 'rate',
        'base', 'vat', 'total', 'taxType', 'branch', 'attachments', 'notes', 'paymentStatusLabel'
    ];

    const escapeCsv = (val) => {
        const s = String(val ?? '');
        if (/[\n\r\t",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };

    let csv = '';
    csv += headers.join(',') + '\n';
    rows.forEach(r => {
        csv += fields.map(h => escapeCsv(r[h])).join(',') + '\n';
    });

    const blob = new Blob(["\uFEFF" + csv], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const from = document.getElementById('dateFrom')?.value || '';
    const to = document.getElementById('dateTo')?.value || '';
    a.download = `vat-detailed-report_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Backward compatibility
function exportReport() {
    exportReportSummary();
}

function exportReportDetailed() {
    closeMenu();

    const rows = filteredData;
    console.log(rows);

    // Arabic headers with line items
    const headers = [
        'التاريخ',
        'رقم المستند',
        'نوع المستند',
        'المرجع',
        'تصنيف الضريبة',
        'كود الضريبة',
        'النسبة',
        'المبلغ غير شامل ضريبة',
        'مبلغ الضريبة',
        'الإجمالي شامل ضريبة',
        'نوع الضريبة',
        'المشروع',
        'المرفقات',
        'حالة السداد',
        'اسم المنتج', // itemName
        'SKU', // itemSku
        'نوع الصنف', // itemType
        'حساب المنتج', // itemAccount
        'الكمية', // itemQty
        'المبلغ', // base_amount from details
        'ضريبة المنتج', // tax_amount from details
        'إجمالي المنتج' // total_amount from details
    ];

    const fields = [
        'date', 'docNo', 'docType', 'reference', 'taxCategory', 'taxCode', 'rate',
        'base', 'vat', 'total', 'taxType', 'branch', 'attachments', 'paymentStatusLabel',
        'itemName', 'itemSku', 'itemType', 'itemAccount', 'itemQty',
        'itemBaseAmount', 'itemTaxAmount', 'itemTotalAmount'
    ];

    const escapeCsv = (val) => {
        const s = String(val ?? '');
        if (/[\n\r\t",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };

    const outRows = [];
    rows.forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];

        if (!items.length) {
            outRows.push({
                ...r,
                itemName: '',
                itemSku: '',
                itemType: '',
                itemAccount: '',
                itemQty: '',
                itemBaseAmount: '',
                itemTaxAmount: '',
                itemTotalAmount: ''
            });
            return;
        }

        items.forEach(li => {
            // Use the actual values from details (base_amount, tax_amount, total_amount)
            const baseAmount = Number(li.price || 0); // price is mapped from base_amount
            const taxAmount = Number(li.vat || 0); // vat is mapped from tax_amount
            const totalAmount = Number(li.total || 0); // total is mapped from total_amount

            outRows.push({
                ...r,
                itemName: li.name ?? '',
                itemSku: li.sku ?? '',
                itemType: getLineItemTypeLabel(li, r.docType),
                itemAccount: li.account || '-',
                itemQty: li.qty ?? '',
                itemBaseAmount: baseAmount, // base_amount from details
                itemTaxAmount: taxAmount, // tax_amount from details
                itemTotalAmount: totalAmount // total_amount from details
            });
        });
    });

    let csv = '';
    csv += headers.join(',') + '\n';
    outRows.forEach(r => {
        csv += fields.map(h => escapeCsv(r[h])).join(',') + '\n';
    });

    const blob = new Blob(["\uFEFF" + csv], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const from = document.getElementById('dateFrom')?.value || '';
    const to = document.getElementById('dateTo')?.value || '';
    a.download = `vat-detailed-report_items_${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function exportSelectedRows() {
    const ids = Array.from(selectedRowIds || []);
    if (!ids.length) return;
    const rows = normalizedVatData.filter(r => selectedRowIds.has(r.id));

    const headers = [
        'التاريخ',
        'رقم المستند',
        'نوع المستند',
        'المرجع',
        'تصنيف الضريبة',
        'كود الضريبة',
        'النسبة',
        'المبلغ غير شامل ضريبة',
        'مبلغ الضريبة',
        'الإجمالي شامل ضريبة',
        'نوع الضريبة',
        'المشروع',
        'المرفقات',
        'حالة السداد'
    ];

    const fields = [
        'date', 'docNo', 'docType', 'reference', 'taxCategory', 'taxCode', 'rate',
        'base', 'vat', 'total', 'taxType', 'branch', 'attachments', 'paymentStatusLabel'
    ];

    const escapeCsv = (val) => {
        const s = String(val ?? '');
        if (/[\n\r\t",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };

    let csv = '';
    csv += headers.join(',') + '\n';
    rows.forEach(r => {
        csv += fields.map(h => escapeCsv(r[h])).join(',') + '\n';
    });

    const blob = new Blob(["\uFEFF" + csv], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vat-selected_${rows.length}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}


function deleteSelectedRows() {
    const count = selectedRowIds.size;
    if (!count) return;

    if (!confirm(`هل تريد حذف ${count} سطر/أسطر محددة؟`)) return;

    const ids = Array.from(selectedRowIds);

    const urlDeleted = "https://foo.thevalue.sa/en/admin/settings/vat-declaration-details/delete-selected";

    fetch(urlDeleted, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': '{{ csrf_token() }}',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            ids
        })
    })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'حدث خطأ أثناء الحذف');
            }
            return data;
        })
        .then(data => {

            // Remove from frontend dataset
            const toDelete = new Set(ids);

            const deletedDocNos = normalizedVatData
                .filter(r => toDelete.has(r.id))
                .map(r => r.docNo);

            normalizedVatData = normalizedVatData.filter(r => !toDelete.has(r.id));

            // Remove related notes
            deletedDocNos.forEach(docNo => {
                if (notesData && notesData[docNo]) {
                    delete notesData[docNo];
                }
            });

            saveNotesData();

            clearSelection();
            fetchVatDeclarationDetails();

            alert(data.message || 'تم الحذف بنجاح ✓');
        })
        .catch(err => {
            alert(err.message);
        });
}



function sendSelectedToZatca() {
    if (selectedRowIds.size === 0) {
        alert('الرجاء تحديد سطر واحد على الأقل');
        return;
    }

    const ids = Array.from(selectedRowIds);

    if (!confirm(`هل تريد إرسال ${ids.length} فاتورة للهيئة؟`)) return;


    const url = "https://foo.thevalue.sa/en/admin/settings/vat/send-to-zatca";

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": "{{ csrf_token() }}"
        },
        body: JSON.stringify({
            ids
        })
    })
        .then(res => res.json())
        .then(data => {
            alert(`${data.count} فاتورة تم إرسالها للهيئة ✓`);

            // update UI
            data.ids.forEach(id => {
                const row = normalizedVatData.find(r => r.id === id);
                if (row) row.zatcaStatus = 'sent';
            });

            clearSelection();
            fetchVatDeclarationDetails();

        })
        .catch(err => {
            console.error(err);
            alert('حدث خطأ أثناء الإرسال');
        });
}

function clearSelection() {
    selectedRowIds = new Set();
    // reset header checkbox
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
    updateBulkActionsBar();
    renderTable();
}

function updateBulkActionsBar() {
    const bar = document.getElementById('bulkActions');
    const countEl = document.getElementById('selectedCount');
    const count = selectedRowIds.size;
    if (countEl) countEl.textContent = String(count);
    if (bar) bar.style.display = count > 0 ? 'block' : 'none';
}

function toggleRowSelection(id, checked) {
    const n = Number(id);
    if (Number.isNaN(n)) return;
    if (checked) selectedRowIds.add(n);
    else selectedRowIds.delete(n);
    syncSelectAllCheckbox();
    updateBulkActionsBar();
}

function getVisibleRowCheckboxes() {
    return Array.from(document.querySelectorAll('#tableBody input.row-select'));
}

function syncSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAll');
    if (!selectAll) return;
    const cbs = getVisibleRowCheckboxes();
    if (!cbs.length) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }
    const ids = cbs.map(cb => Number(cb.dataset.id)).filter(n => !Number.isNaN(n));
    const selected = ids.filter(id => selectedRowIds.has(id)).length;
    selectAll.checked = selected === ids.length;
    selectAll.indeterminate = selected > 0 && selected < ids.length;
}

// ==================== DATE PICKER (Flatpickr) ====================
const loadFlatpickr = () => {
    return new Promise((resolve, reject) => {
        if (window.flatpickr) return resolve();

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js';
        script.onload = () => {
            const ar = document.createElement('script');
            ar.src = 'https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/l10n/ar.js';
            ar.onload = resolve;
            ar.onerror = () => resolve();
            document.head.appendChild(ar);
        };
        script.onerror = () => reject(new Error('Flatpickr load failed'));
        document.head.appendChild(script);
    });
};

function initRangePicker() {
    const hiddenFrom = document.getElementById('dateFrom');
    const hiddenTo = document.getElementById('dateTo');
    if (!hiddenFrom || !hiddenTo) return;

    const defaultFrom = hiddenFrom.value || '2025-01-01';
    const defaultTo = hiddenTo.value || '2025-12-31';

    hiddenFrom.value = defaultFrom;
    hiddenTo.value = defaultTo;
    updateDateRangeDisplay(defaultFrom, defaultTo);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function updateDateRangeDisplay(fromDate, toDate) {
    // Update control dates (حقل الفترة الزمنية)
    const displayFrom = document.getElementById('displayDateFrom');
    const displayTo = document.getElementById('displayDateTo');

    // Update header dates (التاريخ في الأعلى)
    const headerFrom = document.getElementById('headerDateFrom');
    const headerTo = document.getElementById('headerDateTo');

    const dateRangeInput = document.getElementById('dateRangePicker');

    // Update all date displays
    if (displayFrom) displayFrom.textContent = fromDate;
    if (displayTo) displayTo.textContent = toDate;
    if (headerFrom) headerFrom.textContent = fromDate;
    if (headerTo) headerTo.textContent = toDate;

    if (dateRangeInput && fromDate && toDate) {
        dateRangeInput.value = `${fromDate} → إلى: ${toDate}`;
    }
}

function updateDateBoxStates(stage) {
    const dateBoxFrom = document.getElementById('dateBoxFrom');
    const dateBoxTo = document.getElementById('dateBoxTo');

    if (!dateBoxFrom || !dateBoxTo) return;

    // Reset all states
    dateBoxFrom.classList.remove('active', 'filled');
    dateBoxTo.classList.remove('active', 'filled');

    if (stage === 'initial') {
        // Calendar opened - highlight active box
        if (activeBox === 'from') {
            dateBoxFrom.classList.add('active');
            // Keep "to" filled if it has value
            if (document.getElementById('displayDateTo').textContent) {
                dateBoxTo.classList.add('filled');
            }
        } else if (activeBox === 'to') {
            dateBoxTo.classList.add('active');
            // Keep "from" filled if it has value
            if (document.getElementById('displayDateFrom').textContent) {
                dateBoxFrom.classList.add('filled');
            }
        } else if (activeBox === 'range') {
            // Range mode - highlight "from" initially
            dateBoxFrom.classList.add('active');
            if (document.getElementById('displayDateTo').textContent) {
                dateBoxTo.classList.add('filled');
            }
        }
    } else if (stage === 'first-selected') {
        // First date selected in range mode
        dateBoxFrom.classList.add('filled');
        dateBoxTo.classList.add('active');
    } else if (stage === 'completed') {
        // Both dates selected - both filled
        dateBoxFrom.classList.add('filled');
        dateBoxTo.classList.add('filled');
    }
}

function openCalendarForRange() {
    activeBox = 'range';
    if (dateRangePicker) {
        // Switch to range mode
        dateRangePicker.set('mode', 'range');
        const fromValue = document.getElementById('dateFrom').value;
        const toValue = document.getElementById('dateTo').value;
        dateRangePicker.setDate([fromValue, toValue], false);
        dateRangePicker.open();
    }
}

function openCalendarForBox(box) {
    activeBox = box;
    if (dateRangePicker) {
        // Switch to single mode
        dateRangePicker.set('mode', 'single');
        const currentValue = document.getElementById(box === 'from' ? 'dateFrom' : 'dateTo').value;
        dateRangePicker.setDate(currentValue, false);
        dateRangePicker.open();
    } else {
        document.getElementById('dateRangePicker').focus();
    }
}

function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText =
            'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 99999; display: flex; flex-direction: column; gap: 10px; align-items: center;';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toastContainer.removeChild(toast);
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 300);
    }, 3000);
}

function resetDateRange() {
    // Clear state
    currentDateRange = '';

    // Clear Quick Date selection visually
    clearQuickDateSelection();

    // Fetch default data (API will return default dates)
    fetchVatDeclarationDetails(currentType, '');

    // Clear filters and reload local table data if needed, or let the fetch handle it?
    // The user said "Apply filters and reload data" in original code.
    // But now we are driving mainly by the API fetch.
    // Let's keep applyFilters for the client-side table logic if it depends on the date inputs
    // which will be updated by fetchVatDeclarationDetails when it completes.
    // However, applyFilters reads from the DOM inputs immediately.
    // We should probably wait for fetch to complete to update inputs, then apply filters.
    // But fetch is async. 
    // For now, let's just trigger the fetch. The fetch updates the active date range.

    // Also clear the selection in the menu
    const menuItems = document.querySelectorAll('#quickDatesMenu .check-mark');
    menuItems.forEach(el => el.style.opacity = '0');

    // Visual feedback
    showToast('تم إعادة تعيين التاريخ', 'success');
}

function toggleQuickDates(event) {
    event.stopPropagation();
    const menu = document.getElementById('quickDatesMenu');
    const isVisible = menu.style.display === 'block';

    // Close if open, open if closed
    menu.style.display = isVisible ? 'none' : 'block';

    // Close when clicking outside
    if (!isVisible) {
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    }
}

function applyQuickDate(preset) {
    const today = new Date();
    let fromDate, toDate;

    switch (preset) {
        case 'thisMonth':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;

        case 'lastMonth':
            fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            toDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;

        case 'last3Months':
            fromDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
            toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;

        case 'thisQuarter':
            const currentQuarter = Math.floor(today.getMonth() / 3);
            fromDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
            toDate = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0);
            break;

        case 'thisYear':
            fromDate = new Date(today.getFullYear(), 0, 1);
            toDate = new Date(today.getFullYear(), 11, 31);
            break;

        case 'lastYear':
            fromDate = new Date(today.getFullYear() - 1, 0, 1);
            toDate = new Date(today.getFullYear() - 1, 11, 31);
            break;

        default:
            return;
    }

    // Format dates
    const fromStr = formatDate(fromDate);
    const toStr = formatDate(toDate);

    // Update fields
    document.getElementById('dateFrom').value = fromStr;
    document.getElementById('dateTo').value = toStr;
    updateDateRangeDisplay(fromStr, toStr);

    // Update selection indicator
    updateQuickDateSelection(preset);

    // Update flatpickr
    if (dateRangePicker) {
        dateRangePicker.setDate([fromStr, toStr], false);
    }

    document.getElementById('dateRangePicker').value = `${fromStr} → إلى: ${toStr}`;

    // Close menu
    document.getElementById('quickDatesMenu').style.display = 'none';

    // Apply filters
    applyFilters({
        resetPage: true
    });
    saveState();

    // Visual feedback
    showToast('تم تطبيق الفترة', 'success');
}

function updateQuickDateSelection(selectedPreset) {
    // Remove selection from all items
    const allItems = document.querySelectorAll('#quickDatesMenu [data-preset]');
    allItems.forEach(item => {
        item.classList.remove('selected');
        item.style.background = 'white';
        const checkMark = item.querySelector('.check-mark');
        if (checkMark) {
            checkMark.style.opacity = '0';
        }
    });

    // Add selection to current item
    const selectedItem = document.querySelector(`#quickDatesMenu [data-preset="${selectedPreset}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.style.background = 'var(--vp-bg-hover)';
        const checkMark = selectedItem.querySelector('.check-mark');
        if (checkMark) {
            checkMark.style.opacity = '1';
        }
    }
}

function clearQuickDateSelection() {
    // Remove selection from all items
    const allItems = document.querySelectorAll('#quickDatesMenu [data-preset]');
    allItems.forEach(item => {
        item.classList.remove('selected');
        item.style.background = 'white';
        const checkMark = item.querySelector('.check-mark');
        if (checkMark) {
            checkMark.style.opacity = '0';
        }
    });
}

let dateRangePicker;
let activeBox = 'range'; // Track mode: 'from', 'to', or 'range'

function initCustomDatePickers() {
    if (!window.flatpickr) return;

    const fromHidden = document.getElementById('dateFrom')?.value;
    const toHidden = document.getElementById('dateTo')?.value;

    if (!dateRangePicker) {
        dateRangePicker = window.flatpickr('#dateRangePicker', {
            mode: 'range', // Start with range mode
            dateFormat: 'Y-m-d',
            defaultDate: [fromHidden, toHidden],
            locale: 'ar',
            showMonths: 1,
            monthSelectorType: 'dropdown',
            inline: false,
            static: false,
            position: 'below',
            positionElement: document.querySelector('[onclick*="openCalendarForRange"]'),
            onChange: function (selectedDates, dateStr, instance) {
                const currentMode = instance.config.mode;

                if (currentMode === 'range') {
                    // Range Mode
                    if (selectedDates.length === 1) {
                        // First date selected
                        const fromDate = formatDate(selectedDates[0]);
                        document.getElementById('dateFrom').value = fromDate;
                        updateDateRangeDisplay(fromDate, document.getElementById('dateTo').value);
                        updateDateBoxStates('first-selected');
                    } else if (selectedDates.length === 2) {
                        // Both dates selected
                        const fromDate = formatDate(selectedDates[0]);
                        const toDate = formatDate(selectedDates[1]);
                        document.getElementById('dateFrom').value = fromDate;
                        document.getElementById('dateTo').value = toDate;
                        updateDateRangeDisplay(fromDate, toDate);
                        updateDateBoxStates('completed');
                        clearQuickDateSelection();

                        // Call API with custom dates
                        fetchVatDeclarationDetails(null, null, fromDate, toDate);

                        // If we need to filter local table as well (assuming hybrid):
                        applyFilters({
                            resetPage: true
                        });
                        saveState();
                    }
                } else {
                    // Single Mode
                    if (selectedDates.length === 1) {
                        const selectedDate = formatDate(selectedDates[0]);

                        if (activeBox === 'to') {
                            // Update 'إلى' only
                            document.getElementById('dateTo').value = selectedDate;
                            updateDateRangeDisplay(document.getElementById('dateFrom').value,
                                selectedDate);
                        } else {
                            // Update 'من' only
                            document.getElementById('dateFrom').value = selectedDate;
                            updateDateRangeDisplay(selectedDate, document.getElementById('dateTo')
                                .value);
                        }

                        updateDateBoxStates('completed');
                        clearQuickDateSelection();

                        // Get current values
                        const currentFrom = document.getElementById('dateFrom').value;
                        const currentTo = document.getElementById('dateTo').value;

                        // Call API with custom dates
                        fetchVatDeclarationDetails(null, null, currentFrom, currentTo);

                        applyFilters({
                            resetPage: true
                        });
                        saveState();

                        // Close calendar
                        setTimeout(() => {
                            if (dateRangePicker) dateRangePicker.close();
                        }, 100);
                    }
                }
            },
            onOpen: function (selectedDates, dateStr, instance) {
                // Calendar opened - highlight active box
                updateDateBoxStates('initial');

                // Add label to calendar header
                setTimeout(() => {
                    const calendarContainer = dateRangePicker.calendarContainer;
                    if (calendarContainer) {
                        // Remove existing label if any
                        const existingLabel = calendarContainer.querySelector(
                            '.date-selection-label');
                        if (existingLabel) {
                            existingLabel.remove();
                        }

                        // Add new label
                        const label = document.createElement('div');
                        label.className = 'date-selection-label';
                        label.style.cssText =
                            'padding: 8px 12px; background: var(--vp-bg-hover); border-bottom: 2px solid var(--vp-border-light); text-align: center; font-size: 12px; font-weight: 700; color: var(--vp-accent);';

                        if (activeBox === 'range') {
                            label.textContent = 'اختر الفترة الزمنية (من → إلى)';
                        } else if (activeBox === 'from') {
                            label.textContent = 'اختر تاريخ البداية (من)';
                        } else {
                            label.textContent = 'اختر تاريخ النهاية (إلى)';
                        }

                        const monthsContainer = calendarContainer.querySelector(
                            '.flatpickr-months');
                        if (monthsContainer) {
                            calendarContainer.insertBefore(label, monthsContainer);
                        }
                    }
                }, 10);
            },
            onClose: function () {
                // Calendar closed - reset to completed state
                updateDateBoxStates('completed');
            },
            onReady: function (selectedDates, dateStr, instance) {
                // تأكد من ظهور الشهر والسنة
                const calendarContainer = instance.calendarContainer;
                if (calendarContainer) {
                    // Force width to match parent
                    const parentWidth = document.querySelector('[onclick*="dateRangePicker"]')
                        ?.offsetWidth;
                    if (parentWidth) {
                        calendarContainer.style.width = parentWidth + 'px';
                    }
                }
            }
        });

        // Set initial display
        if (fromHidden && toHidden) {
            document.getElementById('dateRangePicker').value = `${fromHidden} → إلى: ${toHidden}`;
            updateDateRangeDisplay(fromHidden, toHidden);
        }
    } else {
        dateRangePicker.setDate([fromHidden, toHidden], false);
        if (fromHidden && toHidden) {
            document.getElementById('dateRangePicker').value = `${fromHidden} → إلى: ${toHidden}`;
            updateDateRangeDisplay(fromHidden, toHidden);
        }
    }
}

function applyDatePreset() {
    const preset = document.getElementById('datePresetSelect').value;

    if (preset === 'custom') {
        // In new design, date fields are always visible, just initialize pickers
        if (!window.flatpickr) {
            loadFlatpickr().then(() => initCustomDatePickers()).catch(() => { });
        } else {
            initCustomDatePickers();
        }
        saveState();
        return;
    }

    const today = new Date();
    let fromDate, toDate;

    switch (preset) {
        case 'today':
            fromDate = toDate = new Date();
            break;

        case 'yesterday': {
            const t = new Date();
            t.setDate(t.getDate() - 1);
            fromDate = toDate = t;
            break;
        }

        case 'this-week': {
            const t = new Date();
            const dayOfWeek = t.getDay();
            const diff = t.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            fromDate = new Date(t.setDate(diff));
            toDate = new Date(fromDate);
            toDate.setDate(fromDate.getDate() + 6);
            break;
        }

        case 'this-month': {
            const t = new Date();
            fromDate = new Date(t.getFullYear(), t.getMonth(), 1);
            toDate = new Date(t.getFullYear(), t.getMonth() + 1, 0);
            break;
        }

        case 'this-quarter': {
            const t = new Date();
            const quarter = Math.floor(t.getMonth() / 3);
            fromDate = new Date(t.getFullYear(), quarter * 3, 1);
            toDate = new Date(t.getFullYear(), quarter * 3 + 3, 0);
            break;
        }

        case 'this-year': {
            const t = new Date();
            fromDate = new Date(t.getFullYear(), 0, 1);
            toDate = new Date(t.getFullYear(), 11, 31);
            break;
        }

        case 'prev-week': {
            const t = new Date();
            t.setDate(t.getDate() - 7);
            const day = t.getDay();
            const diff = t.getDate() - day + (day === 0 ? -6 : 1);
            fromDate = new Date(t.setDate(diff));
            toDate = new Date(fromDate);
            toDate.setDate(fromDate.getDate() + 6);
            break;
        }

        case 'prev-month': {
            const t = new Date();
            fromDate = new Date(t.getFullYear(), t.getMonth() - 1, 1);
            toDate = new Date(t.getFullYear(), t.getMonth(), 0);
            break;
        }

        case 'prev-quarter': {
            const t = new Date();
            const currentQuarter = Math.floor(t.getMonth() / 3);
            let prevQuarter = currentQuarter - 1;
            let year = t.getFullYear();
            if (prevQuarter < 0) {
                prevQuarter = 3;
                year -= 1;
            }
            fromDate = new Date(year, prevQuarter * 3, 1);
            toDate = new Date(year, prevQuarter * 3 + 3, 0);
            break;
        }

        case 'prev-year': {
            const t = new Date();
            fromDate = new Date(t.getFullYear() - 1, 0, 1);
            toDate = new Date(t.getFullYear() - 1, 11, 31);
            break;
        }

        default:
            fromDate = new Date(2025, 0, 1);
            toDate = new Date(2025, 11, 31);
    }

    const fromStr = formatDate(fromDate);
    const toStr = formatDate(toDate);

    document.getElementById('dateFrom').value = fromStr;
    document.getElementById('dateTo').value = toStr;

    updateDateRangeDisplay(fromStr, toStr);

    applyFilters({
        resetPage: true
    });
    saveState();
}

function applyCustomDate() {
    const fromDate = document.getElementById('dateFrom').value;
    const toDate = document.getElementById('dateTo').value;

    if (!fromDate || !toDate) {
        alert('الرجاء اختيار التاريخين');
        return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
        alert('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
    }

    updateDateRangeDisplay(fromDate, toDate);
    applyFilters({
        resetPage: true
    });

    const customInputs = document.getElementById('customDateInputs');
    if (customInputs) customInputs.style.display = 'none';

    saveState();
}

// ==================== VAT MODE ====================
function setVATMode(mode, btnEl) {
    currentVATMode = mode;
    document.querySelectorAll('.mode-pill').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    if (btnEl) {
        btnEl.classList.add('active');
        btnEl.setAttribute('aria-selected', 'true');
    }
    applyFilters({
        resetPage: true
    });
    saveState();
}

// ==================== FILTERS & GROUPING ====================
function applyDocTypeFilter(docType) {
    activeDocTypeFilter = docType;
    const select = document.getElementById('docTypeSelect');
    if (select) select.value = docType;
    updateFilterBadge();
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function applyTaxCategoryFilter(category) {
    activeTaxCategoryFilter = category;
    const select = document.getElementById('taxCategorySelect');
    if (select) select.value = category;
    updateFilterBadge();
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function applyPostingStatusFilter(status) {
    activePostingStatusFilter = status;
    const select = document.getElementById('postingStatusSelect');
    if (select) select.value = status;
    updateFilterBadge();
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function applyPaymentStatusFilter(status) {
    activePaymentStatusFilter = status;
    const select = document.getElementById('paymentStatusSelect');
    if (select) select.value = status;
    updateFilterBadge();
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function applyZatcaStatusFilter(status) {
    activeZatcaStatusFilter = status;
    const select = document.getElementById('zatcaStatusSelect');
    if (select) select.value = status;
    updateFilterBadge();
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function applyGrouping(group) {
    // Prevent 'none' - default to 'docType'
    if (group === 'none') group = 'docType';
    activeGrouping = group;
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function getDocTypeLabel(value) {
    const labels = {
        'INV': 'فاتورة مبيعات',
        'BILL': 'فاتورة مشتريات',
        'CN': 'إشعار دائن',
        'DN': 'إشعار مدين',
        'JE': 'قيود اليومية'
    };
    return labels[value] || value;
}

function getGroupingLabel(value) {
    const labels = {
        'docType': 'نوع المستند',
        'taxCategory': 'فئة الضريبة',
        'taxCode': 'كود الضريبة',
        'branch': 'المشروع',
        'date': 'التاريخ',
        'paymentStatus': 'حالة السداد',
        'postingStatus': 'حالة الترحيل',
        'zatcaStatus': 'حالة الإرسال للهيئة'
    };
    return labels[value] || value;
}

function getGroupValue(item, groupBy) {
    const value = item[groupBy] || 'غير محدد';

    // Translate payment status
    if (groupBy === 'paymentStatus') {
        const labels = {
            'paid': 'مسددة',
            'unpaid': 'غير مسددة',
            'partial': 'مسددة جزئياً',
            'returned': 'مرتجعة'
        };
        return labels[value] || value;
    }

    // Translate posting status
    if (groupBy === 'postingStatus') {
        const labels = {
            'posted': 'مرحّل',
            'draft': 'مسودة',
            'cancelled': 'ملغي'
        };
        return labels[value] || value;
    }

    // Translate ZATCA status
    if (groupBy === 'zatcaStatus') {
        const labels = {
            'sent': 'مُرسل',
            'not_sent': 'لم يُرسل'
        };
        return labels[value] || value;
    }

    return value;
}

function updateActiveChips() {
    const container = document.getElementById('activeChips');
    if (!container) return;

    container.innerHTML = '';

    if (activeDocTypeFilter) {
        addChip('filter', 'docType', getDocTypeLabel(activeDocTypeFilter));
    }

    if (activeTaxCategoryFilter) {
        addChip('filter', 'taxCategory', activeTaxCategoryFilter);
    }

    if (activePaymentStatusFilter) {
        addChip('filter', 'paymentStatus', activePaymentStatusFilter);
    }

    if (activePostingStatusFilter) {
        addChip('filter', 'postingStatus', getPostingStatusLabel(activePostingStatusFilter));
    }

    if (activeZatcaStatusFilter) {
        addChip('filter', 'zatcaStatus', activeZatcaStatusFilter === 'sent' ? 'مُرسل' : 'لم يُرسل');
    }

    if (activeGrouping && activeGrouping !== 'docType') {
        addChip('group', 'grouping', getGroupingLabel(activeGrouping));
    }

    // Show/hide chips container (less clutter)
    container.style.display = container.children.length ? 'flex' : 'none';
}

function addChip(type, key, label) {
    const container = document.getElementById('activeChips');
    if (!container) return;

    const chip = document.createElement('span');
    if (type === 'filter') chip.className = 'active-chip active-chip-filter';
    else if (type === 'group') chip.className = 'active-chip active-chip-group';
    else chip.className = 'active-chip active-chip-filter';

    const icon = document.createElement('span');
    icon.className = 'active-chip-icon';
    icon.textContent = type === 'group' ? '≡' : '▼';

    const text = document.createElement('span');
    text.className = 'active-chip-text';
    text.textContent = label;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'active-chip-close';
    closeBtn.textContent = '×';
    closeBtn.type = 'button';
    closeBtn.onclick = () => removeChip(type, key);

    chip.appendChild(icon);
    chip.appendChild(text);
    chip.appendChild(closeBtn);

    container.appendChild(chip);
}

function removeChip(type, key) {
    if (type === 'filter') {
        if (key === 'docType') {
            activeDocTypeFilter = '';
            const select = document.getElementById('docTypeSelect');
            const checkbox = document.getElementById('filterDocType');
            if (select) select.value = '';
            if (checkbox) {
                checkbox.checked = false;
                const section = document.getElementById('docTypeSection');
                if (section) section.style.display = 'none';
            }
        } else if (key === 'taxCategory') {
            activeTaxCategoryFilter = '';
            const select = document.getElementById('taxCategorySelect');
            const checkbox = document.getElementById('filterTaxCategory');
            if (select) select.value = '';
            if (checkbox) {
                checkbox.checked = false;
                const section = document.getElementById('taxCategorySection');
                if (section) section.style.display = 'none';
            }
        }
        updateFilterBadge();
    } else if (type === 'group') {
        activeGrouping = 'docType';
        const radios = document.querySelectorAll('input[name="groupBy"]');
        radios.forEach(radio => {
            if (radio.value === 'docType') radio.checked = true;
        });
    }

    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

function toggleFiltersMenu() {
    const menu = document.getElementById('filtersMenu');
    const groupMenu = document.getElementById('groupMenu');
    const btn = document.getElementById('filtersBtn');

    if (groupMenu) groupMenu.style.display = 'none';
    document.getElementById('groupBtn')?.classList.remove('active');

    if (!menu) return;
    const willOpen = menu.style.display === 'none' || !menu.style.display;
    menu.style.display = willOpen ? 'block' : 'none';
    btn?.classList.toggle('active', willOpen);
}

function toggleGroupMenu() {
    const menu = document.getElementById('groupMenu');
    const filtersMenu = document.getElementById('filtersMenu');
    const btn = document.getElementById('groupBtn');

    if (filtersMenu) filtersMenu.style.display = 'none';
    document.getElementById('filtersBtn')?.classList.remove('active');

    if (!menu) return;
    const willOpen = menu.style.display === 'none' || !menu.style.display;
    menu.style.display = willOpen ? 'block' : 'none';
    btn?.classList.toggle('active', willOpen);
}

function toggleFilterSection(type) {
    // Support both original and dropdown versions
    const checkboxOriginal = document.getElementById('filter' + type.charAt(0).toUpperCase() + type.slice(1));
    const checkboxDropdown = document.getElementById('filter' + type.charAt(0).toUpperCase() + type.slice(1) +
        '_dropdown');
    const sectionOriginal = document.getElementById(type + 'Section');
    const sectionDropdown = document.getElementById(type + 'Section_dropdown');

    const checkbox = checkboxDropdown || checkboxOriginal;
    const section = sectionDropdown || sectionOriginal;

    if (!checkbox || !section) return;

    if (checkbox.checked) {
        section.style.display = 'block';
        // Sync both checkboxes if both exist
        if (checkboxOriginal) checkboxOriginal.checked = true;
        if (checkboxDropdown) checkboxDropdown.checked = true;
        if (sectionOriginal) sectionOriginal.style.display = 'block';
        if (sectionDropdown) sectionDropdown.style.display = 'block';
    } else {
        section.style.display = 'none';
        // Sync both checkboxes if both exist
        if (checkboxOriginal) checkboxOriginal.checked = false;
        if (checkboxDropdown) checkboxDropdown.checked = false;
        if (sectionOriginal) sectionOriginal.style.display = 'none';
        if (sectionDropdown) sectionDropdown.style.display = 'none';

        if (type === 'docType') {
            const sel = document.getElementById('docTypeSelect') || document.getElementById(
                'docTypeSelect_dropdown');
            if (sel) sel.value = '';
            activeDocTypeFilter = '';
        } else if (type === 'taxCategory') {
            const sel = document.getElementById('taxCategorySelect') || document.getElementById(
                'taxCategorySelect_dropdown');
            if (sel) sel.value = '';
            activeTaxCategoryFilter = '';
        }
        applyFilters({
            resetPage: true
        });
    }

    updateFilterBadge();
    updateActiveChips();
    saveState();
}

function updateFilterBadge() {
    let count = 0;
    if (activeDocTypeFilter) count++;
    if (activeTaxCategoryFilter) count++;
    if (activePaymentStatusFilter) count++;
    if (activePostingStatusFilter) count++;
    if (activeZatcaStatusFilter) count++;

    const badge = document.getElementById('filterBadge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = String(count);
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function clearAllFilters() {
    activeDocTypeFilter = '';
    activeTaxCategoryFilter = '';
    activeGrouping = 'docType';
    activeSearchScope = 'all';
    columnFilters = {};

    const filterDocType = document.getElementById('filterDocType');
    const filterTaxCategory = document.getElementById('filterTaxCategory');
    const docTypeSelect = document.getElementById('docTypeSelect');
    const taxCategorySelect = document.getElementById('taxCategorySelect');
    const docTypeSection = document.getElementById('docTypeSection');
    const taxCategorySection = document.getElementById('taxCategorySection');

    if (filterDocType) filterDocType.checked = false;
    if (filterTaxCategory) filterTaxCategory.checked = false;
    if (docTypeSelect) docTypeSelect.value = '';
    if (taxCategorySelect) taxCategorySelect.value = '';
    if (docTypeSection) docTypeSection.style.display = 'none';
    if (taxCategorySection) taxCategorySection.style.display = 'none';

    const groupRadios = document.querySelectorAll('input[name="groupBy"]');
    groupRadios.forEach(radio => {
        if (radio.value === 'docType') radio.checked = true;
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const filtersMenu = document.getElementById('filtersMenu');
    const groupMenu = document.getElementById('groupMenu');
    if (filtersMenu) filtersMenu.style.display = 'none';
    if (groupMenu) groupMenu.style.display = 'none';

    document.getElementById('filtersBtn')?.classList.remove('active');
    document.getElementById('groupBtn')?.classList.remove('active');

    // Clear column filter indicators
    document.querySelectorAll('.column-filter-btn').forEach(btn => btn.classList.remove('active'));

    updateFilterBadge();
    updateActiveChips();
    applyFilters({
        resetPage: true
    });
    saveState();
}

// ==================== SMART SEARCH ====================
let currentSearchScopes = {};
let smartKbdIndex = -1;
let smartKbdItems = [];

const SEARCH_HISTORY_KEY = 'vp_vat_search_history_v1';

function debounce(fn, wait) {
    let t = null;
    return function (...args) {
        if (t) clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function toggleSearchClearBtn() {
    const input = document.getElementById('searchInput');
    const btn = document.getElementById('searchClearBtn');
    if (!input || !btn) return;
    btn.classList.toggle('show', !!input.value);
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    input.value = '';
    toggleSearchClearBtn();
    // Keep selected scope, just clear the query filter
    showSmartSearchHome();
    applyFilters({
        resetPage: true
    });
    saveState();
    input.focus();
}

function getSearchHistory() {
    try {
        const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function pushSearchHistory(query, scope) {
    const q = String(query || '').trim();
    if (q.length < 2) return;
    const s = String(scope || 'all');
    const now = Date.now();
    const item = {
        q,
        s,
        t: now
    };

    const prev = getSearchHistory();
    const next = [item, ...prev.filter(x => !(x.q === q && x.s === s))].slice(0, 8);
    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch { }
}

function getScopeLabel(scope) {
    const labels = {
        all: 'بحث عام',
        docNo: 'رقم المستند',
        branch: 'المشروع',
        reference: 'المرجع',
        docType: 'نوع المستند',
        taxCode: 'كود الضريبة',
        amounts: 'المبالغ'
    };
    return labels[scope] || scope;
}

function getScopeIcon(scope) {
    const icons = {
        all: '🔎',
        docNo: '№',
        party: '🏢',
        branch: '📁',
        reference: '🔗',
        docType: '📄',
        taxCode: '🏷',
        amounts: '﷼'
    };
    return icons[scope] || '🔎';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function applySuggestionEncoded(scope, encodedValue) {
    try {
        applySuggestion(scope, decodeURIComponent(String(encodedValue || '')));
    } catch {
        applySuggestion(scope, String(encodedValue || ''));
    }
}

function parseAmountQuery(query) {
    const q = String(query || '').trim().replace(/,/g, '');
    const m = q.match(/^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return {
        op: m[1] || '=',
        value: Number(m[2])
    };
}

function matchAmountRow(row, parsed) {
    const vals = [Number(row.base || 0), Number(row.vat || 0), Number(row.total || 0)];
    const v = parsed.value;
    const op = parsed.op;
    const cmp = (x) => {
        if (op === '>') return x > v;
        if (op === '>=') return x >= v;
        if (op === '<') return x < v;
        if (op === '<=') return x <= v;
        // '='
        return x === v;
    };
    return vals.some(cmp);
}

function calculateSearchScopes(query) {
    const lowerQuery = String(query || '').toLowerCase();
    const parsedAmount = parseAmountQuery(lowerQuery);

    const scopes = {
        all: [],
        docNo: [],
        party: [],
        branch: [],
        reference: [],
        docType: [],
        taxCode: [],
        amounts: []
    };

    normalizedVatData.forEach(row => {
        const matchDocNo = row.docNo && row.docNo.toLowerCase().includes(lowerQuery);
        const matchParty = row.party && row.party.toLowerCase().includes(lowerQuery);
        const matchBranch = row.branch && row.branch.toLowerCase().includes(lowerQuery);
        const matchRef = row.reference && row.reference.toLowerCase().includes(lowerQuery);
        const matchDocType = row.docType && row.docType.toLowerCase().includes(lowerQuery);
        const matchTaxCode = row.taxCode && row.taxCode.toLowerCase().includes(lowerQuery);

        const matchAmounts = parsedAmount ?
            matchAmountRow(row, parsedAmount) :
            (String(row.base ?? '').includes(lowerQuery) || String(row.vat ?? '').includes(lowerQuery) ||
                String(row.total ?? '').includes(lowerQuery));

        if (matchDocNo) scopes.docNo.push(row);
        if (matchParty) scopes.party.push(row);
        if (matchBranch) scopes.branch.push(row);
        if (matchRef) scopes.reference.push(row);
        if (matchDocType) scopes.docType.push(row);
        if (matchTaxCode) scopes.taxCode.push(row);
        if (matchAmounts) scopes.amounts.push(row);

        if (matchDocNo || matchParty || matchBranch || matchRef || matchDocType || matchTaxCode ||
            matchAmounts) {
            scopes.all.push(row);
        }
    });

    return scopes;
}

function buildValueSuggestions(query, field, limit = 5) {
    const q = String(query || '').toLowerCase();
    const counts = new Map();
    normalizedVatData.forEach(row => {
        const v = row[field];
        if (!v) return;
        const s = String(v);
        if (s.toLowerCase().includes(q)) {
            counts.set(s, (counts.get(s) || 0) + 1);
        }
    });

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([value, count]) => ({
            value,
            count
        }));
}

function renderSmartItemsKeyboard() {
    smartKbdItems = Array.from(document.querySelectorAll('#smartSearchDropdown .smart-item'));
    smartKbdIndex = -1;
    smartKbdItems.forEach(el => el.classList.remove('kbd-active'));
}

function moveSmartKbd(delta) {
    if (!smartKbdItems.length) return;
    smartKbdIndex = smartKbdIndex + delta;
    if (smartKbdIndex < 0) smartKbdIndex = smartKbdItems.length - 1;
    if (smartKbdIndex >= smartKbdItems.length) smartKbdIndex = 0;
    smartKbdItems.forEach((el, idx) => el.classList.toggle('kbd-active', idx === smartKbdIndex));
    const active = smartKbdItems[smartKbdIndex];
    active?.scrollIntoView({
        block: 'nearest'
    });
}

function applySmartKbdSelection() {
    if (smartKbdIndex < 0 || smartKbdIndex >= smartKbdItems.length) return false;
    smartKbdItems[smartKbdIndex].click();
    return true;
}

function showSmartSearchHome() {
    const dropdown = document.getElementById('smartSearchDropdown');
    if (!dropdown) return;

    const history = getSearchHistory();
    let html = '';

    // Search History (if exists)
    if (history.length) {
        html += '<div class="smart-suggestions-group" style="padding: 12px 16px; background: var(--vp-bg-hover);">';
        html +=
            '<div class="smart-suggestions-header" style="margin-bottom: 10px; font-size: 13px; font-weight: 800; color: var(--vp-text-secondary);">🕘 عمليات بحث أخيرة</div>';
        history.slice(0, 4).forEach((h) => {
            const scope = h.s || 'all';
            const icon = getScopeIcon(scope);
            const label = getScopeLabel(scope);
            const encodedQ = encodeURIComponent(String(h.q || ''));
            const displayQ = escapeHtml(String(h.q || ''));
            html += `
 <div class="smart-item" onclick="applySuggestionEncoded('${scope}', '${encodedQ}')" style="margin-bottom: 6px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: white; border: 1px solid var(--vp-border-light);" onmouseover="this.style.background='var(--vp-accent-lightest)'; this.style.borderColor='var(--vp-accent)';" onmouseout="this.style.background='white'; this.style.borderColor='var(--vp-border-light)';">
 <div class="smart-item-left">
 <span class="smart-item-icon">${icon}</span>
 <span class="smart-item-text" style="font-weight: 600;">${displayQ}</span>
 </div>
 <span class="smart-item-meta" style="font-size: 11px; font-weight: 700;">${escapeHtml(label)}</span>
 </div>
 `;
        });
        html += '</div>';
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('active');
    renderSmartItemsKeyboard();
}

function showSmartSearchResults(query) {
    const dropdown = document.getElementById('smartSearchDropdown');
    if (!dropdown) return;

    currentSearchScopes = calculateSearchScopes(query);

    const scopes = currentSearchScopes;
    const totalResults = Object.entries(scopes)
        .filter(([k]) => k !== 'all')
        .reduce((sum, [, arr]) => sum + (arr?.length || 0), 0);

    let html = '';

    if (totalResults === 0) {
        html += '<div class="search-no-results">لا توجد نتائج</div>';
        dropdown.innerHTML = html;
        dropdown.classList.add('active');
        renderSmartItemsKeyboard();
        return;
    }

    // Suggestions from actual values (fast pick)
    const isScoped = activeSearchScope && activeSearchScope !== 'all';
    const scopeToField = {
        docNo: 'docNo',
        taxCode: 'taxCode',
        reference: 'reference',
        branch: 'branch',
        docType: 'docType'
    };

    let suggestions = [];

    if (activeSearchScope === 'amounts') {
        const parsed = parseAmountQuery(query);
        if (!parsed) {
            html += '<div class="smart-suggestions-group">';
            html += '<div class="smart-suggestions-header">💡 أمثلة للمبالغ</div>';
            ['>10000', '>=5000', '=1500', '<250'].forEach(ex => {
                const encoded = encodeURIComponent(ex);
                html += `
 <div class="smart-item" onclick="applySuggestionEncoded('amounts', '${encoded}')">
 <div class="smart-item-left">
 <span class="smart-item-icon">${getScopeIcon('amounts')}</span>
 <span class="smart-item-text">${escapeHtml(ex)}</span>
 </div>
 <span class="smart-item-meta">مثال</span>
 </div>
 `;
            });
            html += '</div>';
        } else {
            // one suggestion to commit current numeric query
            suggestions = [{
                scope: 'amounts',
                icon: getScopeIcon('amounts'),
                items: [{
                    value: query.trim(),
                    count: scopes.amounts.length
                }]
            }];
        }
    } else if (isScoped && scopeToField[activeSearchScope]) {
        const f = scopeToField[activeSearchScope];
        suggestions = [{
            scope: activeSearchScope,
            icon: getScopeIcon(activeSearchScope),
            items: buildValueSuggestions(query, f, 8)
        }].filter(g => g.items.length > 0);
    } else {
        // Default fallback: treat as docNo to avoid "بحث عام" complexity
        suggestions = [{
            scope: 'docNo',
            icon: getScopeIcon('docNo'),
            items: buildValueSuggestions(query, 'docNo', 8)
        }].filter(g => g.items.length > 0);
    }

    if (suggestions.length) {
        html += '<div class="smart-suggestions-group">';
        html += '<div class="smart-suggestions-header">⚡ نتائج سريعة</div>';
        suggestions.forEach(group => {
            group.items.forEach((it) => {
                const encoded = encodeURIComponent(String(it.value || ''));
                const display = escapeHtml(String(it.value || ''));
                html += `
 <div class="smart-item" onclick="applySuggestionEncoded('${group.scope}', '${encoded}')">
 <div class="smart-item-left">
 <span class="smart-item-icon">${group.icon}</span>
 <span class="smart-item-text">${display}</span>
 </div>
 <span class="smart-item-meta">${it.count}</span>
 </div>
 `;
            });
        });
        html += '</div>';
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('active');
    renderSmartItemsKeyboard();
}

function commitSearch() {
    const input = document.getElementById('searchInput');
    const query = input?.value?.trim() || '';
    if (query.length >= 2) pushSearchHistory(query, activeSearchScope);
    document.getElementById('smartSearchDropdown')?.classList.remove('active');

    // Trigger API search
    fetchVatDeclarationDetails();

    // Keep local filter if needed, but primarily reliance is now on API for search?
    // User asked to "send to API". Usually this means server-side filtering.
    // We should probably still update the UI state.
    applyFilters({
        resetPage: true
    });
    saveState();
}

function updateSearchPlaceholder() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    const keyObj = apiSearchKeys.find(k => k.value === activeSearchScope);
    const label = keyObj ? keyObj.label : (apiSearchKeys.length > 0 ? apiSearchKeys[0].label : '');
    input.placeholder = label ? `🔍 ${label}...` : '🔍 ...';
}

// here
function toggleSearchFilter(event) {
    event.stopPropagation();
    let columnKey = 'paymentStatus'; // Default
    if (activeSearchScope === 'postingStatus' || activeSearchScope === 'posting_status') columnKey =
        'postingStatus';
    if (activeSearchScope === 'zatcaStatus' || activeSearchScope === 'zatca_status' || activeSearchScope ===
        'sent_status') columnKey = 'zatcaStatus';
    if (activeSearchScope === 'listedStatus' || activeSearchScope === 'listed_status') columnKey = 'vatReturn';

    if (activeSearchScope === "carry_forward_status") columnKey = "postingStatus";
    // Close other dropdowns
    document.querySelectorAll('.column-filter-dropdown').forEach(d => {
        if (d.dataset.column !== columnKey) d.remove();
    });

    const existing = document.querySelector('.column-filter-dropdown[data-column="' + columnKey + '"]');
    if (existing) {
        existing.remove();
        return;
    }

    const btn = document.getElementById('searchFilterBtn');
    if (!btn) return;

    const dropdown = createColumnFilterDropdown(columnKey);
    if (!dropdown) return;

    dropdown.dataset.column = columnKey;

    document.body.appendChild(dropdown);

    const rect = btn.getBoundingClientRect();
    const isRTL = document.dir === 'rtl' || document.body.dir === 'rtl';
    
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    
    if (isRTL) {
        dropdown.style.right = (window.innerWidth - rect.right) + 'px';
        dropdown.style.left = 'auto';
    } else {
        dropdown.style.left = rect.left + 'px';
        dropdown.style.right = 'auto';
    }
    
    dropdown.style.maxWidth = '320px';
    dropdown.style.zIndex = '9500';

    // Update dropdown position on scroll
    const updatePosition = () => {
        const newRect = btn.getBoundingClientRect();
        dropdown.style.top = (newRect.bottom + 4) + 'px';
        
        if (isRTL) {
            dropdown.style.right = (window.innerWidth - newRect.right) + 'px';
        } else {
            dropdown.style.left = newRect.left + 'px';
        }
    };
    window.addEventListener('scroll', updatePosition, true);

    // Clean up listener when dropdown is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === dropdown) {
                    window.removeEventListener('scroll', updatePosition, true);
                    observer.disconnect();
                }
            });
        });
    });
    observer.observe(document.body, { childList: true });



}

function updateSearchFilterButtonState() {
    const btnText = document.getElementById('searchFilterBtnText');
    if (!btnText) return;

    let columnKey = 'paymentStatus';
    if (activeSearchScope === "sent_status" || activeSearchScope === "zatcaStatus") columnKey = "zatcaStatus";
    if (activeSearchScope === "listed_status" || activeSearchScope === "vatReturn") columnKey = "vatReturn";
    if (activeSearchScope === "carry_forward_status" || activeSearchScope === "postingStatus") columnKey =
        "postingStatus";
    if (activeSearchScope === "payment_status" || activeSearchScope === "paymentStatus") columnKey =
        "paymentStatus";


    const current = columnFilters[columnKey] || [];
    if (current.length === 0) {
        btnText.textContent = 'اختر الحالة...';
        btnText.style.color = 'var(--vp-text-muted)';
    } else {
        // Map values to labels
        let options = [];
        if (columnKey === 'paymentStatus') options = apiPaymentStatuses;
        else if (columnKey === 'postingStatus') options = apiCarryForwardStatuses;
        else if (columnKey === 'zatcaStatus') options = apiSentStatuses;
        else if (columnKey === 'listedStatus') options = apiSentStatuses;
        else if (columnKey === 'vatReturn') options = apiListedStatuses;
        else if (columnKey === 'taxCategory') options = apiTaxCategories;
        else if (columnKey === 'attachments') options = apiattachementsLabels;



        const labels = current.map(val => {
            const opt = options.find(o => o.value === val);
            return opt ? opt.label : val;
        });

        btnText.textContent = labels.join(', ');
        btnText.style.color = 'var(--vp-text-primary)';
    }
}


function onSearchScopeChange(scope) {
    activeSearchScope = scope;

    // Fallback if empty/invalid (though select should prevent this mostly)
    if (!activeSearchScope && apiSearchKeys.length > 0) {
        activeSearchScope = apiSearchKeys[0].value;
    }
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const filterBtn = document.getElementById('searchFilterBtn');


    const isFilterScope = ['paymentStatus', 'payment_status', "sent_status", "listed_status",
        'carry_forward_status',
        'posting_status', 'zatcaStatus', 'zatca_status', 'vatReturn', 'vat_return'
    ].includes(activeSearchScope);

    if (isFilterScope) {
        if (input) {
            input.value = ''; // Clear text query to avoid invalid keywordFilters
            input.style.display = 'none';
        }
        if (clearBtn) clearBtn.style.display = 'none';
        if (filterBtn) {
            filterBtn.style.display = 'flex';
            updateSearchFilterButtonState();
        }
    } else {
        if (input) input.style.display = 'block';
        if (clearBtn) toggleSearchClearBtn();
        if (filterBtn) filterBtn.style.display = 'none';
    }

    updateSearchPlaceholder();
    saveState();

    if (!isFilterScope) {
        const query = input?.value?.trim() || '';
        if (document.activeElement === input) {
            if (!query) showSmartSearchHome();
            else showSmartSearchResults(query);
        }
    }

    // Re-trigger smart search to update suggestions based on new scope
    applyFilters({
        resetPage: true
    });
}

function updateColumnHeaderFilters() {
    document.querySelectorAll('th[data-col]').forEach(th => {
        const columnKey = th.dataset.col;
        const current = columnFilters[columnKey] || [];

        let labelEl = th.querySelector('.column-filter-label');
        if (labelEl) labelEl.remove();

        if (current.length > 0) {
            let labelText = current[0];
            let options = [];
            if (columnKey === 'paymentStatus') options = apiPaymentStatuses;
            else if (columnKey === 'postingStatus') options = apiCarryForwardStatuses;
            else if (columnKey === 'zatcaStatus') options = apiSentStatuses;
            else if (columnKey === 'vatReturn') options = apiListedStatuses;
            else if (columnKey === 'taxCategory') options = apiTaxCategories;
            else if (columnKey === 'attachments') options = apiattachementsLabels;

            if (options.length > 0) {
                const opt = options.find(o => o.value === current[0]);
                if (opt) labelText = opt.label;
            }

            const pill = document.createElement('span');
            pill.className = 'column-filter-label';
            pill.textContent = labelText;

            const btn = th.querySelector('.column-filter-btn');
            if (btn) {
                btn.after(pill);
            } else {
                th.appendChild(pill);
            }
        }
    });
}

function applySuggestion(scope, value) {
    const input = document.getElementById('searchInput');
    if (!input) return;
    activeSearchScope = scope || (apiSearchKeys.length > 0 ? apiSearchKeys[0].value : '');
    updateSearchPlaceholder();
    input.value = String(value || '');
    toggleSearchClearBtn();
    updateActiveChips();
    document.getElementById('smartSearchDropdown')?.classList.remove('active');
    pushSearchHistory(input.value, activeSearchScope);
    applyFilters({
        resetPage: true
    });
    saveState();
}

const handleSmartSearchDebounced = debounce(() => {
    const input = document.getElementById('searchInput');
    const query = input?.value?.trim() || '';
    toggleSearchClearBtn();

    if (query.length === 0) {
        showSmartSearchHome();
        applyFilters({
            resetPage: true
        });
        saveState();
        return;
    }

    // Show results even for 1 character to feel responsive (accounting UX)
    showSmartSearchResults(query);
    applyFilters({
        resetPage: true
    });
    saveState();
}, 150);

function handleSmartSearch() {
    handleSmartSearchDebounced();
}

function showSmartSearch() {
    toggleSearchClearBtn();
    const input = document.getElementById('searchInput');
    const query = input?.value?.trim() || '';
    if (!query) showSmartSearchHome();
    else showSmartSearchResults(query);
}

// ==================== CORE FILTERING ====================
async function applyFilters(opts = {}) {
    const resetPage = opts.resetPage === true;
    if (resetPage) currentPage = 1;

    filteredData = [...normalizedVatData];

    // Date range
    const fromInput = document.getElementById('dateFrom');
    const toInput = document.getElementById('dateTo');

    if (fromInput && toInput && fromInput.value && toInput.value) {
        const fromDate = new Date(fromInput.value);
        const toDate = new Date(toInput.value);

        filteredData = filteredData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= fromDate && itemDate <= toDate;
        });
    }

    // VAT mode
    if (currentVATMode === 'output') {
        filteredData = filteredData.filter(i => i.taxType === 'output');
    } else if (currentVATMode === 'input') {
        filteredData = filteredData.filter(i => i.taxType === 'input');
    }

    // Document type filter
    if (activeDocTypeFilter) {
        const docTypeMap = {
            'INV': 'فاتورة مبيعات',
            'BILL': 'فاتورة مشتريات',
            'CN': 'إشعار دائن',
            'DN': 'إشعار مدين',
            'JE': 'قيود اليومية'
        };
        const targetDocType = docTypeMap[activeDocTypeFilter];
        if (targetDocType) filteredData = filteredData.filter(i => i.docType === targetDocType);
    }

    // Tax category filter
    if (activeTaxCategoryFilter) {
        if (activeTaxCategoryFilter === 'خاضع للضريبة') {
            filteredData = filteredData.filter(i => (i.taxCategory || '').includes('خاضعة'));
        } else if (activeTaxCategoryFilter === 'معفى من الضريبة') {
            filteredData = filteredData.filter(i => (i.taxCategory || '').includes('معفاة') || (i.taxCategory ||
                '').includes('معفى'));
        } else if (activeTaxCategoryFilter === 'نسبة صفر') {
            filteredData = filteredData.filter(i => (i.taxCategory || '').includes('صادرات') || Number(i
                .rate) === 0);
        } else {
            filteredData = filteredData.filter(i => i.taxCategory === activeTaxCategoryFilter);
        }
    }

    // Payment status filter
    if (activePaymentStatusFilter) {
        filteredData = filteredData.filter(i => i.paymentStatus === activePaymentStatusFilter);
    }

    // Posting status filter
    if (activePostingStatusFilter) {
        filteredData = filteredData.filter(i => i.postingStatus === activePostingStatusFilter);
    }

    // ZATCA status filter
    if (activeZatcaStatusFilter) {
        filteredData = filteredData.filter(i => i.zatcaStatus === activeZatcaStatusFilter);
    }

    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) {
        const search = searchInput.value.toLowerCase();
        const parsedAmount = (activeSearchScope === 'amounts') ? parseAmountQuery(searchInput.value) : null;
        filteredData = filteredData.filter(item => {
            if (activeSearchScope === 'amounts') {
                if (parsedAmount) return matchAmountRow(item, parsedAmount);
                // fallback: substring match across numeric fields (without commas)
                const needle = search.replace(/,/g, '').trim();
                const hay = [
                    String(item.base ?? ''),
                    String(item.vat ?? ''),
                    String(item.total ?? '')
                ].join(' ');
                return hay.includes(needle);
            }

            const fields = {
                docNo: [item.docNo],
                branch: [item.branch],
                reference: [item.reference],
                docType: [item.docType],
                taxCode: [item.taxCode]
            };

            if (activeSearchScope === 'all') {
                // Real "بحث عام": search across all main text fields
                const allFields = [
                    item.docNo, item.branch, item.reference, item.docType, item.taxCode, item
                        .taxCategory
                ];
                return allFields.some(v => String(v || '').toLowerCase().includes(search));
            }

            const list = fields[activeSearchScope] || fields.docNo;
            return list.some(v => String(v || '').toLowerCase().includes(search));
        });
    }

    // Column filters
    Object.keys(columnFilters).forEach(columnKey => {
        const filterValues = columnFilters[columnKey];
        if (!filterValues || filterValues.length === 0) return;

        if (columnKey === 'attachments') {
            filteredData = filteredData.filter(row => {
                const count = Number(row.attachments || 0);
                const hasValue = count > 0;
                if (filterValues.includes('has') && filterValues.includes('no')) return true;
                if (filterValues.includes('has')) return hasValue;
                if (filterValues.includes('no')) return !hasValue;
                return true;
            });
            return;
        }

        if (columnKey === 'notes') {
            // Notes are rendered from persisted notesData (not only row.notes).
            // Keep filtering consistent with what the user sees.
            loadNotesData();
            filteredData = filteredData.filter(row => {
                const baseNote = String(row.notes || '').trim();
                const persisted = Array.isArray(notesData?.[row.docNo]) ? notesData[row.docNo] :
                    [];
                const hasValue = baseNote.length > 0 || persisted.length > 0;
                if (filterValues.includes('has') && filterValues.includes('no')) return true;
                if (filterValues.includes('has')) return hasValue;
                if (filterValues.includes('no')) return !hasValue;
                return true;
            });
            return;
        }


        if (columnKey === 'zatcaStatus') {
            filteredData = filteredData.filter(row => {
                const status = String(row.zatcaStatus || '');
                return filterValues.includes(status);
            });
            return;
        }

        if (columnKey === 'vatReturn') {
            filteredData = filteredData.filter(row => {
                const status = String(row.vatReturn || '');
                return filterValues.includes(status);
            });
            return;
        }

        const searchValue = String(filterValues[0] || '').toLowerCase();
        filteredData = filteredData.filter(row => {
            let val = row[columnKey];
            if (val === undefined || val === null) return false;
            return String(val).toLowerCase().includes(searchValue);
        });
    });

    // Grouping
    if (activeGrouping && activeGrouping !== 'docType') {
        groupedData = {};
        filteredData.forEach(item => {
            let key;
            if (activeGrouping === 'date') {
                const dateValue = item.date;
                key = dateValue ? dateValue.split('-')[0] : 'غير محدد';
            } else if (activeGrouping === 'paymentStatus') {
                key = getGroupValue(item, 'paymentStatus');
            } else if (activeGrouping === 'postingStatus') {
                key = getGroupValue(item, 'postingStatus');
            } else if (activeGrouping === 'zatcaStatus') {
                key = getGroupValue(item, 'zatcaStatus');
            } else {
                key = item[activeGrouping] || 'غير محدد';
            }
            if (!groupedData[key]) groupedData[key] = [];
            groupedData[key].push(item);
        });
    } else {
        groupedData = {};
    }


    renderTable();
    updatePagination();
    applyColumnVisibility();
}


// ==================== TABLE RENDER ====================

function toggleApiGroup(groupKey) {
    if (expandedApiGroups.has(groupKey)) {
        expandedApiGroups.delete(groupKey);
    } else {
        expandedApiGroups.add(groupKey);
    }
    renderTable();
}
window.toggleApiGroup = toggleApiGroup;

async function renderTable(apiResponse = null) {

    // Transform API data
    if (apiResponse === null && lastApiResponse !== null) {
        apiResponse = lastApiResponse;
    }

    // Store the response for future use
    if (apiResponse !== null) {
        lastApiResponse = apiResponse;
    } else if (lastApiResponse === null) {
        // No data available at all
        console.error('No data available to render');
        return;
    }

    // Now process the response...
    apiVatData = transformApiData(apiResponse);
    apiSummary = apiResponse.summary || {};

    // Update normalized data
    normalizedVatData = apiVatData;
    filteredData = [...normalizedVatData];

    const tbody = document.getElementById('tableBody');
    let html = '';

    // Check if API response is grouped
    const isApiGrouped = apiResponse && apiResponse.grouped === true;

    if (isApiGrouped) {
        const groups = apiResponse.data || [];
        const visibleColspan = getVisibleKeysInOrder().length || 17;

        groups.forEach(group => {
            const groupKey = String(group.group_name || '');
            const isGroupExpanded = expandedApiGroups.has(groupKey);
            const itemCount = group.count || (group.items ? group.items.length : 0);

            // Group header row
            // RTL Layout: Flex container. 
            // We want [Text & Totals] [Arrow] visually, which in RTL (Right-to-Left) means Arrow is on the Left (end).
            // But usually "After" in RTL means to the Left.
            // Let's use flex-direction: row (RTL natural) -> Right is start, Left is end.
            // If we want Arrow on the LEFT (end) and Text on the RIGHT (start):
            // Just put Content first, Arrow second.

            // Group header row aligned with columns
            const visibleKeys = getVisibleKeysInOrder();

            // Identify target column indices
            const baseIdx = visibleKeys.indexOf('base');
            const vatIdx = visibleKeys.indexOf('vat');
            const totalIdx = visibleKeys.indexOf('total');

            // Map targets if they exist in visible columns
            const targets = [{
                key: 'base',
                idx: baseIdx,
                val: group.base_amount,
                label: 'الأساس'
            },
            {
                key: 'vat',
                idx: vatIdx,
                val: group.tax_amount,
                label: 'الضريبة'
            },
            {
                key: 'total',
                idx: totalIdx,
                val: group.total_amount,
                label: 'الإجمالي'
            }
            ].filter(t => t.idx !== -1).sort((a, b) => a.idx - b.idx);

            let rowHtml = '';

            if (targets.length === 0) {
                // Fallback: No summary columns visible, just span all
                rowHtml += `<td colspan="${visibleKeys.length}" style="padding: 12px 16px;">
                    <div style="display: flex; align-items: center; justify-content: flex-start; gap: 12px;">
                        <span class="group-toggle" style="display:inline-block; width:16px; text-align:center; transition: transform 0.2s; transform: ${isGroupExpanded ? 'rotate(0deg)' : 'rotate(90deg)'}; margin-left:8px;">
                            ▼
                        </span>
                        <span style="font-size: 14px;">${escapeHtml(groupKey)}</span>
                        <span style="font-size: 12px; color: var(--vp-text-secondary);">(${itemCount})</span>
                    </div>
                 </td>`;
            } else {
                const firstTargetIdx = targets[0].idx;

                // 1. Label Cell (spans up to first target)
                if (firstTargetIdx > 0) {
                    rowHtml += `<td colspan="${firstTargetIdx}" style="padding: 12px 16px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="group-toggle" style="display:inline-block; width:16px; text-align:center; transition: transform 0.2s; transform: ${isGroupExpanded ? 'rotate(0deg)' : 'rotate(90deg)'}; cursor: pointer;">
                                ▼
                            </span>
                            <span style="font-size: 14px;">${escapeHtml(groupKey)}</span>
                            <span style="font-size: 12px; color: var(--vp-text-secondary);">(${itemCount})</span>
                        </div>
                    </td>`;
                }

                // 2. Target Columns
                // We iterate from firstTargetIdx to lastTargetIdx
                const lastTargetIdx = targets[targets.length - 1].idx;

                for (let i = firstTargetIdx; i <= lastTargetIdx; i++) {
                    const key = visibleKeys[i];
                    const target = targets.find(t => t.key === key);

                    if (target) {
                        // Render value
                        // Styling matches the existing table cells roughly
                        rowHtml += `<td style="font-weight:800; color:var(--vp-primary); padding: 12px 8px; font-size:13px;">
                            ${fmt(target.val || 0)}
                        </td>`;
                    } else {
                        // Empty cell for interleaved columns
                        rowHtml += `<td></td>`;
                    }
                }

                // 3. Remainder
                const remainingCols = visibleKeys.length - 1 - lastTargetIdx;
                if (remainingCols > 0) {
                    rowHtml += `<td colspan="${remainingCols}"></td>`;
                }
            }

            html += `<tr class="group-header-row" data-group-key="${escapeHtml(groupKey)}" style="background: var(--vp-bg-alt); font-weight: 700; cursor: pointer;" onclick="window.toggleApiGroup(this.dataset.groupKey)">
                ${rowHtml}
            </tr>`;

            // Group items (if expanded)
            if (isGroupExpanded && Array.isArray(group.items)) {
                group.items.forEach(item => {
                    const badge = item.taxType === 'output' ? 'badge-output' : 'badge-input';
                    const attach = Number(item.attachments || 0) > 0 ?
                        `${item.attachments} 📎` : '–';
                    const hasItems = item.details && item.details.length > 0;
                    const showItemLines = itemsLinesView === 'detailed';
                    const isCollapsed = collapsedItemDocNos.has(String(item.document));
                    const itemsCountForRow = hasItems ? item.details.length : 0;

                    // Transform item for display
                    const transformedItem = {
                        id: item.id,
                        date: item.date || '-',
                        docNo: item.document || '-',
                        docType: item.type,
                        revenueAccount: Array.isArray(item.acount_name) ? item.acount_name
                            .join(' - ') : '',
                        reference: item.reference || '-',
                        taxCategory: item.tax_category.join(" - ") || '-',
                        taxCode: Array.isArray(item.tax_codes) ? item.tax_codes.join(
                            ' - ') : '',
                        rate: Array.isArray(item.tax_rates) ? item.tax_rates.join(" - ") :
                            '0%',
                        base: item.base_amount || 0,
                        vat: item.tax_amount || 0,
                        total: item.total_amount || 0,
                        taxType: Array.isArray(item.tax_type) ? item.tax_type.join(' - ') :
                            '',
                        branch: item.project || '-',
                        attachments: item.attachments || 0,
                        notes: item.notes || [],
                        notes_count: Array.isArray(item.notes) ? item.notes.length : 0,
                        zatcaStatus: item.is_sent_to_tax_zakat,
                        vatReturn: item.vat_declaration,
                        postingStatus: item.carry_forward_status,
                        createdDate: item.created_at || item.date,
                        createdBy: item.created_by || '-',
                        paymentStatus: item.payment_status,
                        paymentStatusLabel: item.payment_status
                    };
                    console.log(transformedItem);

                    html += `<tr>
                        <td data-col="expand">
                            ${hasItems ? `
                                <span class="items-row-meta">
                                    ${showItemLines ? `<span class="items-row-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="toggleInvoiceItems('${transformedItem.docNo}'); event.stopPropagation();" title="${isCollapsed ? 'فتح سطور المنتجات' : 'طي سطور المنتجات'}">${!isCollapsed ? '◀' : '▼'}</span>` : ''}
                                    <span class="items-count-badge" title="عدد المنتجات">📦 ${itemsCountForRow}</span>
                                </span>
                            ` : ''}
                        </td>
                        <td data-col="select"><input class="row-select" type="checkbox" data-id="${transformedItem.id}" ${selectedRowIds.has(transformedItem.id) ? 'checked' : ''} onchange="toggleRowSelection(${transformedItem.id}, this.checked)" aria-label="تحديد"></td>
                        <td data-col="date">${transformedItem.date}</td>
                        <td data-col="createdDate">${transformedItem.createdDate}</td>
                        <td data-col="docNo">${transformedItem.docNo}</td>
                        <td data-col="docType">${transformedItem.docType}</td>
                        <td data-col="revenueAccount">${transformedItem.revenueAccount || '—'}</td>
                        <td data-col="reference">${transformedItem.reference}</td>
                        <td data-col="taxCategory">${transformedItem.taxCategory}</td>
                        <td data-col="taxCode"><span class="badge-tax ${badge}">${transformedItem.taxCode}</span></td>
                        <td data-col="rate">${transformedItem.rate}</td>
                        <td data-col="base" class="${transformedItem.base > 0 ? 'positive' : ''}">${fmt(transformedItem.base)}</td>
                        <td data-col="vat" class="${transformedItem.vat > 0 ? 'positive' : ''}">${fmt(transformedItem.vat)}</td>
                        <td data-col="total">${fmt(transformedItem.total)}</td>
                        <td data-col="taxType">${transformedItem.taxType}</td>
                        <td data-col="branch">${transformedItem.branch}</td>
                        <td data-col="attachments">${attach}</td>
                        <td data-col="notes" onclick="event.stopPropagation()">
                            <div class="note-cell">
                            ${transformedItem.notes_count > 0 ? `
                                <button class="note-add-btn" type="button" onclick="toggleNoteEditor('${transformedItem.docNo}'); event.stopPropagation();" title="إضافة ملاحظة">+</button>
                                <span class="note-badge">${Array.isArray(transformedItem.notes) ? transformedItem.notes[transformedItem.notes.length - 1] : ''}</span>
                                <span class="notes-count-badge">${transformedItem.notes_count}</span>
                            ` : `
                                <button class="note-add-btn" type="button" onclick="toggleNoteEditor('${transformedItem.docNo}'); event.stopPropagation();" title="إضافة ملاحظة">+</button>
                                <span>-</span>
                            `}
                            </div>
                        </td>
                        <td data-col="paymentStatus"><span class="payment-status ${transformedItem.paymentStatus}">${transformedItem.paymentStatus}</span></td>
                        <td data-col="createdBy">${transformedItem.createdBy}</td>
                        <td data-col="postingStatus">${transformedItem.postingStatus}</td>
                        <td data-col="zatcaStatus">${transformedItem.zatcaStatus}</td>
                        <td data-col="vatReturn">${transformedItem.vatReturn}</td>
                        <td data-col="actions"><div class="actions">
                            <button class="action-btn" onclick="openDetailsPanel(${transformedItem.id})" title="عرض" type="button">👁️</button>
                            <button class="action-btn" onclick="deleteRow('${transformedItem.id}', '${transformedItem.docNo}', event)"  title="حذف" type="button">🗑️</button>
                        </div></td>
                    </tr>`;

                    // Add details rows if expanded
                    if (showItemLines && hasItems && isCollapsed) {
                        html += `<tr class="items-container-row">
                            <td colspan="${visibleColspan}" style="padding: 0; border: none;">
                                <div class="line-items-wrap">
                                    <div class="line-items-panel" role="region" aria-label="سطور الفاتورة">
                                        <div class="line-items-grid head">
                                            <div class="line-items-cell">المنتج</div>
                                            <div class="line-items-cell">اسم الحساب</div>
                                            <div class="line-items-cell">النوع</div>
                                            <div class="line-items-cell">الكمية</div>
                                            <div class="line-items-cell">الكود</div>
                                            <div class="line-items-cell">المبلغ غير شامل ضريبة</div>
                                            <div class="line-items-cell">مبلغ الضريبة</div>
                                            <div class="line-items-cell">الإجمالي شامل ضريبة</div>
                                        </div>`;

                        item.details.forEach(detail => {
                            html += `<div class="line-items-grid body line-items-row">
                                <div class="line-items-cell line-items-name" data-label="المنتج">
                                    <strong>${escapeHtml(detail.item_name || '')}</strong>
                                </div>
                                <div class="line-items-cell" data-label="اسم الحساب">${escapeHtml(detail.account_name || '')}</div>
                                <div class="line-items-cell" data-label="النوع">${escapeHtml(detail.type || 'منتج')}</div>
                                <div class="line-items-cell" data-label="الكمية"><span class="qty-pill">${fmtQty(detail.quantity || 0)}</span></div>
                                <div class="line-items-cell line-items-num" data-label="الكود">${escapeHtml(detail.tax_code || 'غير محدد')}</div>
                                <div class="line-items-cell line-items-num" data-label="المبلغ غير شامل ضريبة">${fmt(detail.base_amount || 0)}</div>
                                <div class="line-items-cell line-items-num" data-label="مبلغ الضريبة">${fmt(detail.tax_amount || 0)}</div>
                                <div class="line-items-cell line-items-num" data-label="الإجمالي شامل ضريبة">${fmt(detail.total_amount || 0)}</div>
                            </div>`;
                        });

                        html += `</div></div></td></tr>`;
                    }
                });
            }
        });
    } else if (!activeGrouping || activeGrouping === 'docType') {
        const start = (currentPage - 1) * perPage;
        const pageData = filteredData.slice(start, start + perPage);

        pageData.forEach(item => {
            const badge = item.taxType === 'output' ? 'badge-output' : 'badge-input';
            const attach = Number(item.attachments || 0) > 0 ? `${item.attachments} 📎` : '–';
            const notesArr = getNotesForDoc(item.docNo);
            const notesCount = notesArr.length;
            const lastNote = notesCount ? String(notesArr[0].text || '') : '';
            const notesTitle = lastNote ? escapeHtml(lastNote) : '';
            const preview = lastNote ? escapeHtml(lastNote) : '';
            const isEditorOpen = activeNoteEditorDocNo === item.docNo;

            const hasItems = item.items && item.items.length > 0;
            const showItemLines = itemsLinesView === 'detailed';
            const isCollapsed = collapsedItemDocNos.has(String(item.docNo));
            const itemsCountForRow = hasItems ? item.items.length : 0;

            html += `<tr>
 <td data-col="expand">
 ${hasItems ? `
 <span class="items-row-meta">
 ${showItemLines ? `<span class="items-row-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="toggleInvoiceItems('${item.docNo}'); event.stopPropagation();" title="${isCollapsed ? 'فتح سطور المنتجات' : 'طي سطور المنتجات'}">${!isCollapsed ? '◀' : '▼'}</span>` : ''}
 <span class="items-count-badge" title="عدد المنتجات">📦 ${itemsCountForRow}</span>
 </span>
 ` : ''}
 </td>
 <td data-col="select"><input class="row-select" type="checkbox" data-id="${item.id}" ${selectedRowIds.has(item.id) ? 'checked' : ''} onchange="toggleRowSelection(${item.id}, this.checked)" aria-label="تحديد"></td>
 <td data-col="date">${item.date}</td>
 <td data-col="createdDate">${item.createdDate || item.date}</td>
 <td data-col="docNo">${item.docNo}</td>
 <td data-col="docType">${item.docType}</td>
 <td data-col="revenueAccount">${item.revenueAccount || '—'}</td>
 <td data-col="reference">${item.reference}</td>
 <td data-col="taxCategory">${item.taxCategory}</td>
 <td data-col="taxCode"><span class="badge-tax ${badge}">${item.taxCode}</span></td>
 <td data-col="rate">${item.rate}</td>
 <td data-col="base" class="${item.base > 0 ? 'positive' : ''}">${fmt(item.base)}</td>
 <td data-col="vat" class="${item.vat > 0 ? 'positive' : ''}">${fmt(item.vat)}</td>
 <td data-col="total">${fmt(item.total)}</td>
 <td data-col="taxType">${item.taxType}</td>
 <td data-col="branch">${item.branch}</td>
 <td data-col="attachments">${attach}</td>
 <td data-col="notes" onclick="event.stopPropagation()">
 <div class="note-cell">
 ${item.notes_count > 0 ? `
 <button class="note-add-btn" type="button" onclick="toggleNoteEditor('${item.docNo}'); event.stopPropagation();" title="إضافة ملاحظة">+</button>
 <span class="note-badge">${Array.isArray(item.notes) ? item.notes[item.notes.length - 1] : ''}</span>
 <span class="notes-count-badge">${item.notes_count}</span>
 ` : `
 <span>-</span>
 <button class="note-add-btn" type="button" onclick="toggleNoteEditor('${item.docNo}'); event.stopPropagation();" title="إضافة ملاحظة">+</button>
 `}
 </div>
 <div class="note-editor ${isEditorOpen ? 'show' : ''}" onclick="event.stopPropagation()">
 <div class="note-editor-row">
 <input id="noteInput_${item.docNo}" type="text" placeholder="اكتب ملاحظة..." onkeydown="if(event.key==='Enter'){saveNoteEditor('${item.docNo}')}; if(event.key==='Escape'){cancelNoteEditor()}" />
 <button class="note-editor-save" type="button" onclick="saveNoteEditor('${item.docNo}')">حفظ</button>
 <button class="note-editor-cancel" type="button" onclick="cancelNoteEditor()" aria-label="إلغاء">×</button>
 </div>
 </div>
 </td>
 <td data-col="paymentStatus"><span class="payment-status ${item.paymentStatus}"> ${item.paymentStatus}</span></td>
 <td data-col="createdBy">${item.createdBy || ''}</td>
 <td data-col="postingStatus">${item.postingStatus}</td>
 <td data-col="zatcaStatus">${item.zatcaStatus}</td>
 <td data-col="vatReturn">${item.vatReturn}</td>
 <td data-col="actions"><div class="actions">
 <button class="action-btn" onclick="openDetailsPanel(${item.id})" title="عرض" type="button">👁️</button>
 <button class="action-btn" onclick="deleteRow('${item.id}', '${item.docNo}', event)"
 title="حذف" type="button">🗑️</button>
 </div></td>
 </tr>`;

            // Add item rows if expanded
            if (showItemLines && hasItems && isCollapsed) {
                const visibleColspan = getVisibleKeysInOrder().length || 17;

                html += `<tr class="items-container-row">
 <td colspan="${visibleColspan}" style="padding: 0; border: none;">
 <div class="line-items-wrap">
 <div class="line-items-panel" role="region" aria-label="سطور الفاتورة">
 <div class="line-items-grid head">
 <div class="line-items-cell line-items-name">المنتج</div>
 <div class="line-items-cell">اسم الحساب</div>
 <div class="line-items-cell">النوع</div>
 <div class="line-items-cell">الكمية</div>
 <div class="line-items-cell">الكود</div>
 <div class="line-items-cell">المبلغ غير شامل ضريبة</div>
 <div class="line-items-cell">مبلغ الضريبة</div>
 <div class="line-items-cell">الإجمالي شامل ضريبة</div>
 </div>

 ${item.items.map((lineItem) => {
                    const sku = String(lineItem.sku || '').trim();
                    const account = String(lineItem.account || '-').trim();
                    const type = String(lineItem.type || '-').trim();
                    const qty = Number(lineItem.qty || 0);
                    const baseLine = Number(lineItem.price || 0);
                    const vatLine = Number(lineItem.vat ?? 0);
                    const Code = lineItem.taxCode;
                    const unitExcl = (lineItem.price || 0);
                    const totalIncl = Number(lineItem.total ?? (baseLine + vatLine));
                    return `
 <div class="line-items-grid body line-items-row">
 <div class="line-items-cell line-items-name" data-label="المنتج">
 <span class="nm">${escapeHtml(lineItem.name || '')}</span>
 <span class="meta">${sku ? `<span class="sku">${escapeHtml(sku)}</span>` : `<span class="sku">—</span>`}</span>
 </div>
 <div class="line-items-cell" data-label="اسم الحساب">${escapeHtml(account)}</div>
 <div class="line-items-cell" data-label="النوع">${escapeHtml(type)}</div>
 <div class="line-items-cell" data-label="الكمية"><span class="qty-pill">${fmtQty(qty)}</span></div>
 <div class="line-items-cell line-items-num" data-label="الكود">${escapeHtml(Code)}</div>
 <div class="line-items-cell line-items-num" data-label="المبلغ غير شامل ضريبة">${fmt(unitExcl)}</div>
 <div class="line-items-cell line-items-num" data-label="مبلغ الضريبة">${fmt(vatLine)}</div>
 <div class="line-items-cell line-items-num" data-label="الإجمالي شامل ضريبة">${fmt(totalIncl)}</div>
 </div>
 `;
                }).join('')}
 </div>
 </div>
 </td>
 </tr>`;
            }
        });
    } else {
        const visibleKeys = getVisibleKeysInOrder();
        const visibleCount = visibleKeys.length || 16;
        const visibleColspan = visibleKeys.length || 16;
        const visibleGroupTotals = [{
            key: 'base',
            label: 'المبلغ غير شامل ضريبة',
            value: (items) => items.reduce((s, i) => s + Number(i.base || 0), 0)
        },
        {
            key: 'vat',
            label: 'مبلغ الضريبة',
            value: (items) => items.reduce((s, i) => s + Number(i.vat || 0), 0)
        },
        {
            key: 'total',
            label: 'الإجمالي شامل ضريبة',
            value: (items) => items.reduce((s, i) => s + Number(i.total || 0), 0)
        }
        ].filter(t => visibleColumns[t.key] !== false);

        const keys = Object.keys(groupedData);
        keys.forEach(groupKey => {
            const items = groupedData[groupKey];
            const isExpanded = !!expandedGroups[groupKey];

            const safeKey = encodeURIComponent(String(groupKey));

            const firstTotalKey = visibleGroupTotals.length ? visibleGroupTotals[0].key : null;
            const totalsStartIdx = firstTotalKey ? visibleKeys.indexOf(firstTotalKey) : -1;

            // If totals start at the first visible column (or totals hidden), use a single-cell row to avoid alignment issues.
            if (visibleGroupTotals.length === 0 || totalsStartIdx <= 0) {
                const parts = visibleGroupTotals.map(t => `${t.label}: ${fmt(t.value(items))}`).join(
                    ' • ');
                html += `<tr class="group-row" onclick="toggleGroup('${safeKey}')">
 <td colspan="${visibleCount}">
 <div class="group-cell">
 <span class="group-toggle ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▼' : '▶'}</span>
 <span class="group-label">${groupKey}</span>
 <span class="group-badge">${items.length}</span>
 ${parts ? `<span style="margin-right:auto; font-weight:800; color: var(--vp-primary);">${parts}</span>` : ''}
 </div>
 </td>
 </tr>`;
            } else {
                const taxCodeIdx = visibleKeys.indexOf('taxCode');
                const leadingSpan = taxCodeIdx >= 0 ? taxCodeIdx : totalsStartIdx;
                if (leadingSpan <= 0) {
                    const parts = visibleGroupTotals.map(t => `${t.label}: ${fmt(t.value(items))}`)
                        .join(' • ');
                    html += `<tr class="group-row" onclick="toggleGroup('${safeKey}')">
 <td colspan="${visibleCount}">
 <div class="group-cell">
 <span class="group-toggle ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▼' : '▶'}</span>
 <span class="group-label">${groupKey}</span>
 <span class="group-badge">${items.length}</span>
 ${parts ? `<span style="margin-right:auto; font-weight:800; color: var(--vp-primary);">${parts}</span>` : ''}
 </div>
 </td>
 </tr>`;
                } else {
                    const midSpan = Math.max(0, totalsStartIdx - leadingSpan);
                    const trailingSpan = Math.max(0, visibleCount - leadingSpan - midSpan -
                        visibleGroupTotals.length);

                    html += `<tr class="group-row" onclick="toggleGroup('${safeKey}')">`;
                    html += `<td colspan="${leadingSpan}">
 <div class="group-cell">
 <span class="group-toggle ${isExpanded ? 'expanded' : ''}">${isExpanded ? '▼' : '▶'}</span>
 <span class="group-label">${groupKey}</span>
 <span class="group-badge">${items.length}</span>
 </div>
 </td>`;

                    if (midSpan > 0) {
                        html +=
                            `<td colspan="${midSpan}" style="text-align: center; font-weight: 700; color: var(--vp-text-secondary);">الإجمالي</td>`;
                    }

                    visibleGroupTotals.forEach(t => {
                        const v = fmt(t.value(items));
                        const color = t.key === 'total' ? 'var(--vp-text-primary)' :
                            'var(--vp-primary)';
                        html += `<td style="font-weight: 800; color: ${color};">${v}</td>`;
                    });

                    if (trailingSpan > 0) html += `<td colspan="${trailingSpan}"></td>`;
                    html += `</tr>`;
                }
            }

            if (isExpanded) {
                items.forEach(item => {
                    const badge = item.taxType === 'output' ? 'badge-output' : 'badge-input';
                    const attach = Number(item.attachments || 0) > 0 ?
                        `${item.attachments} 📎` : '–';
                    const notesArr = getNotesForDoc(item.docNo);
                    const notesCount = notesArr.length;
                    const lastNote = notesCount ? String(notesArr[0].text || '') : '';
                    const notesTitle = lastNote ? escapeHtml(lastNote) : '';
                    const preview = lastNote ? escapeHtml(lastNote) : '';
                    const isEditorOpen = activeNoteEditorDocNo === item.docNo;

                    const hasItems = item.items && item.items.length > 0;
                    const showItemLines = itemsLinesView === 'detailed';
                    const isCollapsed = collapsedItemDocNos.has(String(item.docNo));
                    const itemsCountForRow = hasItems ? item.items.length : 0;

                    html += `<tr>
 <td data-col="expand">
 ${hasItems ? `
 <span class="items-row-meta">
 ${showItemLines ? `<span class="items-row-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="toggleInvoiceItems('${item.docNo}'); event.stopPropagation();" title="${isCollapsed ? 'فتح سطور المنتجات' : 'طي سطور المنتجات'}">${isCollapsed ? '◀' : '▼'}</span>` : ''}
 <span class="items-count-badge" title="عدد المنتجات">📦 ${itemsCountForRow}</span>
 </span>
 ` : ''}
 </td>
 <td data-col="select"><input class="row-select" type="checkbox" data-id="${item.id}" ${selectedRowIds.has(item.id) ? 'checked' : ''} onchange="toggleRowSelection(${item.id}, this.checked)" aria-label="تحديد"></td>
 <td data-col="date">${item.date}</td>
 <td data-col="createdDate">${item.createdDate || item.date}</td>
 <td data-col="docNo">${item.docNo}</td>
 <td data-col="docType">${item.docType}</td>
 <td data-col="revenueAccount">${item.revenueAccount || '—'}</td>
 <td data-col="reference">${item.reference}</td>
 <td data-col="taxCategory">${item.taxCategory}</td>
 <td data-col="taxCode"><span class="badge-tax ${badge}">${item.taxCode}</span></td>
 <td data-col="rate">${item.rate}%</td>
 <td data-col="base" class="${item.base > 0 ? 'positive' : ''}">${fmt(item.base)}</td>
 <td data-col="vat" class="${item.vat > 0 ? 'positive' : ''}">${fmt(item.vat)}</td>
 <td data-col="total">${fmt(item.total)}</td>
 <td data-col="taxType">${item.taxType}</td>
 <td data-col="branch">${item.branch}</td>
 <td data-col="attachments">${attach}</td>
 <td data-col="notes" onclick="event.stopPropagation()">
 <div class="note-cell">
 ${notesCount > 0 ? `
 <button class="note-add-btn" type="button" onclick="toggleNoteEditor('${item.docNo}'); event.stopPropagation();" title="إضافة ملاحظة">+</button>
 <span class="note-badge">${preview}</span>
 <span class="notes-count-badge">${notesCount}</span>
 ` : `
 <button class="note-add-btn" type="button" onclick="toggleNoteEditor('${item.docNo}'); event.stopPropagation();" title="إضافة ملاحظة">+</button>
 <span>-</span>
 `}
 </div>
 <div class="note-editor ${isEditorOpen ? 'show' : ''}" onclick="event.stopPropagation()">
 <div class="note-editor-row">
 <input id="noteInput_${item.docNo}" type="text" placeholder="اكتب ملاحظة..." onkeydown="if(event.key==='Enter'){saveNoteEditor('${item.docNo}')}; if(event.key==='Escape'){cancelNoteEditor()}" />
 <button class="note-editor-save" type="button" onclick="saveNoteEditor('${item.docNo}')">حفظ</button>
 <button class="note-editor-cancel" type="button" onclick="cancelNoteEditor()" aria-label="إلغاء">×</button>
 </div>
 </div>
 </td>
 <td data-col="paymentStatus"><span class="payment-status ${item.paymentStatus}">${item.paymentStatusLabel}</span></td>
 <td data-col="createdBy">${item.createdBy || 'النظام'}</td>
 <td data-col="postingStatus">${getPostingStatusBadge(item.postingStatus)}</td>
 <td data-col="zatcaStatus">${getZatcaStatusBadge(item.zatcaStatus)}</td>
 <td data-col="vatReturn">${getVatReturnBadge(item.vatReturn, item.date)}</td>
 <td data-col="actions"><div class="actions">
 <button class="action-btn" onclick="openDetailsPanel(${item.id})" title="عرض" type="button">👁️</button>
 <button class="action-btn" onclick="deleteRow('${item.id}', '${item.docNo}', event)"
 title="حذف" type="button">🗑️</button>
 </div></td>
 </tr>`;

                    // Add item rows if expanded
                    if (showItemLines && hasItems && !isCollapsed) {
                        html += `<tr class="items-container-row">
 <td colspan="${visibleColspan}" style="padding: 0; border: none;">
 <div class="line-items-wrap">
 <div class="line-items-panel" role="region" aria-label="سطور الفاتورة">
 <div class="line-items-grid head">
 <div class="line-items-cell line-items-name">المنتج</div>
 <div class="line-items-cell">اسم الحساب</div>
 <div class="line-items-cell">النوع</div>
 <div class="line-items-cell">الكمية</div>
 <div class="line-items-cell">المبلغ غير شامل ضريبة</div>
 <div class="line-items-cell">مبلغ الضريبة</div>
 <div class="line-items-cell">الإجمالي شامل ضريبة</div>
 </div>

 ${item.items.map((lineItem) => {
                            const sku = String(lineItem.sku || '').trim();
                            const account = String(lineItem.account || '-').trim();
                            const type = String(lineItem.type || 'منتج').trim();
                            const qty = Number(lineItem.qty || 0);
                            const baseLine = Number(lineItem.total ?? (Number(lineItem.priceExclVat || lineItem.price || 0) * qty) ?? 0);
                            const vatLine = Number(lineItem.vatAmount ?? lineItem.vat ?? 0);
                            const unitExcl = (qty && qty !== 0) ? (baseLine / qty) : Number(lineItem.priceExclVat || lineItem.price || 0);
                            const totalIncl = Number(lineItem.priceInclVat ?? (baseLine + vatLine));
                            return `
 <div class="line-items-grid body line-items-row">
 <div class="line-items-cell line-items-name" data-label="المنتج">
 <span class="nm">${escapeHtml(lineItem.name || '')}</span>
 <span class="meta">${sku ? `<span class="sku">${escapeHtml(sku)}</span>` : `<span class="sku">—</span>`}</span>
 </div>
 <div class="line-items-cell" data-label="اسم الحساب">${escapeHtml(account)}</div>
 <div class="line-items-cell" data-label="النوع">${escapeHtml(type)}</div>
 <div class="line-items-cell" data-label="الكمية"><span class="qty-pill">${fmtQty(qty)}</span></div>
 <div class="line-items-cell line-items-num" data-label="المبلغ غير شامل ضريبة">${fmt(unitExcl)}</div>
 <div class="line-items-cell line-items-num" data-label="مبلغ الضريبة">${fmt(vatLine)}</div>
 <div class="line-items-cell line-items-num" data-label="الإجمالي شامل ضريبة">${fmt(totalIncl)}</div>
 </div>
 `;
                        }).join('')}
 </div>
 </div>
 </td>
 </tr>`;
                    }
                });
            }
        });
    }

    const visibleColspan = getVisibleKeysInOrder().length || 16;
    tbody.innerHTML = html || `<tr><td colspan="${visibleColspan}">لا توجد نتائج</td></tr>`;

    const totalBase = filteredData.reduce((s, i) => s + Number(i.base || 0), 0);
    const totalVat = filteredData.reduce((s, i) => s + Number(i.vat || 0), 0);
    const totalAmount = filteredData.reduce((s, i) => s + Number(i.total || 0), 0);

    rebuildFooterRow(totalBase, totalVat, totalAmount);

    applyColumnVisibility();
    syncSelectAllCheckbox();
    updateBulkActionsBar();
}

function toggleGroup(key) {
    const decodedKey = decodeURIComponent(String(key));
    expandedGroups[decodedKey] = !expandedGroups[decodedKey];
    renderTable();
    saveState();
}

// ==================== PAGINATION ====================
function updatePagination() {
    const total = filteredData.length;
    const totalCountEl = document.getElementById('totalCount');
    if (totalCountEl) totalCountEl.textContent = String(total);

    const isGrouped = activeGrouping && activeGrouping !== 'docType';
    const paginationContainer = document.querySelector('.pagination');

    if (isGrouped) {
        const pageStartEl = document.getElementById('pageStart');
        const pageEndEl = document.getElementById('pageEnd');
        if (pageStartEl) pageStartEl.textContent = '1';
        if (pageEndEl) pageEndEl.textContent = String(total);
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const end = Math.min(currentPage * perPage, total);

    const pageStartEl = document.getElementById('pageStart');
    const pageEndEl = document.getElementById('pageEnd');
    if (pageStartEl) pageStartEl.textContent = String(start);
    if (pageEndEl) pageEndEl.textContent = String(end);

    // Generate pagination buttons
    if (paginationContainer) {
        let html = '';

        // Previous button
        html +=
            `<button class="page-btn nav-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="prevPage()" type="button">▶</button>`;

        // Page numbers with ellipsis logic
        const maxVisible = 7; // Maximum number of page buttons to show

        if (totalPages <= maxVisible) {
            // Show all pages
            for (let i = 1; i <= totalPages; i++) {
                html +=
                    `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})" type="button">${i}</button>`;
            }
        } else {
            // Show with ellipsis
            html +=
                `<button class="page-btn ${1 === currentPage ? 'active' : ''}" onclick="goToPage(1)" type="button">1</button>`;

            if (currentPage > 3) {
                html += `<span class="page-ellipsis">...</span>`;
            }

            const startPage = Math.max(2, currentPage - 1);
            const endPage = Math.min(totalPages - 1, currentPage + 1);

            for (let i = startPage; i <= endPage; i++) {
                html +=
                    `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})" type="button">${i}</button>`;
            }

            if (currentPage < totalPages - 2) {
                html += `<span class="page-ellipsis">...</span>`;
            }

            html +=
                `<button class="page-btn ${totalPages === currentPage ? 'active' : ''}" onclick="goToPage(${totalPages})" type="button">${totalPages}</button>`;
        }

        // Next button
        html +=
            `<button class="page-btn nav-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="nextPage()" type="button">◀</button>`;

        paginationContainer.innerHTML = html;
    }
}

function prevPage() {
    const isGrouped = activeGrouping && activeGrouping !== 'docType';
    if (isGrouped) return;
    if (currentPage > 1) {
        currentPage--;
        applyFilters({
            resetPage: false
        });
        saveState();
    }
}

function nextPage() {
    const isGrouped = activeGrouping && activeGrouping !== 'docType';
    if (isGrouped) return;
    const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
    if (currentPage < totalPages) {
        currentPage++;
        applyFilters({
            resetPage: false
        });
        saveState();
    }
}

function goToPage(pageNum) {
    const isGrouped = activeGrouping && activeGrouping !== 'docType';
    if (isGrouped) return;
    const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));
    if (pageNum >= 1 && pageNum <= totalPages) {
        currentPage = pageNum;
        applyFilters({
            resetPage: false
        });
        saveState();
    }
}

function changePerPage(val) {
    perPage = parseInt(val, 10);
    currentPage = 1;
    applyFilters({
        resetPage: false
    });
    saveState();
}


function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    const cbs = getVisibleRowCheckboxes();
    cbs.forEach(cb => {
        cb.checked = checked;
        const id = Number(cb.dataset.id);
        if (Number.isNaN(id)) return;
        if (checked) selectedRowIds.add(id);
        else selectedRowIds.delete(id);
    });
    syncSelectAllCheckbox();
    updateBulkActionsBar();
}

// ==================== DETAILS PANEL ====================
function openDetailsPanel(id) {
    const transaction = normalizedVatData.find(t => t.id === id);
    if (!transaction) return;
    loadNotesData();

    document.getElementById('detailsDocNumber').textContent = transaction.docNo;
    document.getElementById('detailsDocTypeBadge').textContent = transaction.docType;
    document.getElementById('detailsDate').textContent = transaction.date;
    document.getElementById('detailsBranch').textContent = transaction.branch;
    document.getElementById('detailsReference').textContent = transaction.reference;

    document.getElementById('detailsBase').textContent = formatNumber(transaction.base);
    document.getElementById('detailsRate').textContent = transaction.rate;
    document.getElementById('detailsVAT').textContent = formatNumber(transaction.vat);
    document.getElementById('detailsTotal').textContent = formatNumber(transaction.total);

    document.getElementById('detailsTaxCategory').textContent = transaction.taxCategory;
    document.getElementById('detailsTaxCode').textContent = transaction.taxCode;
    document.getElementById('detailsTaxType').textContent = transaction.taxTyp;
    document.getElementById('detailsStatus').textContent = 'نشط';

    const notesContainer = document.getElementById('detailsNotes');
    const notes = getNotesForDoc(transaction.docNo);
    if (notes.length > 0) {
        notesContainer.innerHTML = notes.map(note => `
            <div class="details-note-item">
                <p class="details-note-text">${escapeHtml(note.text)}</p>
            </div>
        `).join('\n');
    } else {
        notesContainer.innerHTML = '<p class="details-notes-empty">لا توجد ملاحظات</p>';
    }

    // Add note input
    notesContainer.innerHTML += `
 <div class="details-add-note">
 <input id="detailsNewNote" type="text" placeholder="اكتب ملاحظة جديدة..." />
 <button type="button" onclick="addNoteFromDetails('${transaction.docNo}')">إضافة</button>
 </div>
 `;

    const attachmentsCount = Number(transaction.attachments || 0);
    document.getElementById('detailsAttachments').innerHTML =
        `<span class="details-attachments-count">${attachmentsCount} مرفق</span>`;

    // Display items
    const itemsContainer = document.getElementById('detailsItems');
    if (transaction.items && transaction.items.length > 0) {
        itemsContainer.innerHTML = `
 <div class="line-items-panel" role="region" aria-label="تفاصيل المنتجات">
 <div class="line-items-grid head">
 <div class="line-items-cell line-items-name">المنتج</div>
 <div class="line-items-cell">اسم الحساب</div>
 <div class="line-items-cell">النوع</div>
 <div class="line-items-cell">الكمية</div>
 <div class="line-items-cell">المبلغ غير شامل ضريبة</div>
 <div class="line-items-cell">مبلغ الضريبة</div>
 <div class="line-items-cell">الإجمالي شامل ضريبة</div>
 </div>

 ${transaction.items.map((li) => {
            const sku = String(li.sku || '').trim();
            const account = String(li.account || '-').trim();
            const type = String(li.type || '-').trim();
            const qty = Number(li.qty || 0);
            const baseLine = Number(li.total ?? (Number(li.priceExclVat || li.price || 0) * qty) ?? 0);
            const vatLine = Number(li.vatAmount ?? li.vat ?? 0);
            const unitExcl = (qty && qty !== 0) ? (baseLine / qty) : Number(li.priceExclVat || li.price || 0);
            const totalIncl = Number(li.priceInclVat ?? (baseLine + vatLine));
            return `
 <div class="line-items-grid body line-items-row">
 <div class="line-items-cell line-items-name" data-label="المنتج">
 <span class="nm">${escapeHtml(li.name || '')}</span>
 <span class="meta">${sku ? `<span class="sku">${escapeHtml(sku)}</span>` : `<span class="sku">—</span>`}</span>
 </div>
 <div class="line-items-cell" data-label="اسم الحساب">${escapeHtml(account)}</div>
 <div class="line-items-cell" data-label="النوع">${escapeHtml(type)}</div>
 <div class="line-items-cell" data-label="الكمية"><span class="qty-pill">${fmtQty(qty)}</span></div>
 <div class="line-items-cell line-items-num" data-label="المبلغ غير شامل ضريبة">${formatNumber(unitExcl)}</div>
 <div class="line-items-cell line-items-num" data-label="مبلغ الضريبة">${formatNumber(vatLine)}</div>
 <div class="line-items-cell line-items-num" data-label="الإجمالي شامل ضريبة">${formatNumber(totalIncl)}</div>
 </div>
 `;
        }).join('')}
 </div>
 `;
    } else {
        itemsContainer.innerHTML = '<p class="details-notes-empty">لا توجد منتجات</p>';
    }

    document.getElementById('detailsOverlay').classList.add('show');
    document.getElementById('detailsPanel').classList.add('show');
    document.body.style.overflow = 'hidden';
}


function closeDetailsPanel() {
    document.getElementById('detailsOverlay').classList.remove('show');
    document.getElementById('detailsPanel').classList.remove('show');
    document.body.style.overflow = '';
}

// ==================== COLUMN MODAL (Visibility) ====================
function openColumnModal() {
    const modal = document.getElementById('columnModal');
    if (modal) {
        modal.classList.add('show');
        renderColumnsList();
    }
    closeMenu();
}

function closeColumnModal() {
    const modal = document.getElementById('columnModal');
    if (modal) modal.classList.remove('show');
}

function renderColumnsList() {
    let html = '';
    DEFAULT_COLUMNS.forEach((col) => {
        const isExpand = col.key === 'expand';
        const checked = itemsLinesView === 'detailed';
        const disabled = isExpand ? 'disabled' : '';
        const isChecked = isExpand ? (checked ? 'checked' : '') : (visibleColumns[col.key] !== false ?
            'checked' : '');
        html += `<div class="column-item" data-key="${col.key}">
 <span class="column-drag" aria-hidden="true">⋮⋮</span>
 <input type="checkbox" class="column-checkbox" id="col_${col.key}" ${isChecked} ${disabled} onchange="toggleColumnVisibility('${col.key}', this.checked)">
 <label class="column-label" for="col_${col.key}">${col.label}</label>
 </div>`;
    });

    const list = document.getElementById('columnsList');
    if (list) list.innerHTML = html;
}

function toggleColumnVisibility(key, isVisible) {
    if (key === 'expand') return; // keep expand fixed to avoid layout issues
    visibleColumns[key] = !!isVisible;
    renderTable(); // rebuild grouped rows + footer layout safely
    saveState();
}

function applyColumnVisibility() {
    const table = document.getElementById('vatTable');
    if (!table) return;

    const expandVisible = itemsLinesView === 'detailed';

    // Headers
    table.querySelectorAll('thead th[data-col]').forEach(th => {
        const key = th.getAttribute('data-col');
        const show = (key === 'expand') ? expandVisible : (visibleColumns[key] !== false);
        th.style.display = show ? '' : 'none';
    });

    // Body cells
    table.querySelectorAll('tbody td[data-col]').forEach(td => {
        const key = td.getAttribute('data-col');
        const show = (key === 'expand') ? expandVisible : (visibleColumns[key] !== false);
        td.style.display = show ? '' : 'none';
    });
}

function searchColumns(query) {
    document.querySelectorAll('#columnsList .column-item').forEach(item => {
        const label = item.querySelector('.column-label')?.textContent || '';
        item.style.display = label.includes(query) ? 'flex' : 'none';
    });
}

function saveColumns() {
    closeColumnModal();
    saveState();
    alert('تم حفظ الإعدادات');
}

function resetColumns() {
    visibleColumns = DEFAULT_COLUMNS.reduce((acc, c) => {
        acc[c.key] = true;
        return acc;
    }, {});
    visibleColumns.expand = true;
    renderColumnsList();
    renderTable(); // rebuild grouped rows + footer layout safely
    saveState();
}

// ==================== COLUMN FILTERS ====================
function toggleColumnFilter(event, columnKey) {
    event.stopPropagation();

    // Ignore date column filter (kept as you had)
    if (columnKey === 'date') return;


    // Close other filters
    document.querySelectorAll('.column-filter-dropdown').forEach(d => {
        if (d.dataset.column !== columnKey) d.remove();
    });

    const existing = document.querySelector('.column-filter-dropdown[data-column="' + columnKey + '"]');
    if (existing) {
        existing.remove();
        activeColumnFilter = null;
        return;
    }

    const th = event.target.closest('th');
    const dropdown = createColumnFilterDropdown(columnKey);
    if (!dropdown || !th) return;

    dropdown.dataset.column = columnKey;

    document.body.appendChild(dropdown);
    const rect = th.getBoundingClientRect();
    const isRTL = document.dir === 'rtl' || document.body.dir === 'rtl';
    
    dropdown.style.top = (rect.bottom + 8) + 'px';
    
    if (isRTL) {
        dropdown.style.right = (window.innerWidth - rect.right) + 'px';
        dropdown.style.left = 'auto';
    } else {
        dropdown.style.left = rect.left + 'px';
        dropdown.style.right = 'auto';
    }

    activeColumnFilter = columnKey;
}

function createColumnFilterDropdown(columnKey) {
    if (columnKey === 'date') return null;

    const dropdown = document.createElement('div');
    dropdown.className = 'column-filter-dropdown active';

    const columnNames = {
        docNo: 'المستند',
        docType: 'النوع',
        reference: 'المرجع',
        taxCode: 'الكود',
        accountName: 'اسم الحساب',
        createdBy: 'تم الانشاء بواسطة',
        project: 'المشروع',
        type: 'النوع',
        taxType: 'نوع الضريبة',
        rate: 'النسبة',
        base: 'المبلغ الخاضع',
        vat: 'الضريبة',
        total: 'الإجمالي',
        branch: 'المشروع',
        attachments: 'المرفقات',
        notes: 'الملاحظات',
        paymentStatus: 'حالة السداد',
        zatcaStatus: 'حالة الإرسال للهيئة',
        vatReturn: 'الإقرار الضريبي'
    };

    let html = '<div class="column-filter-header"><span>فلترة ' + (columnNames[columnKey] || columnKey) +
        '</span><span onclick="event.stopPropagation(); closeColumnFilter(\'' + columnKey +
        '\')" style="cursor: pointer; opacity: 0.6;">✕</span></div><div class="column-filter-body">';

    if (columnKey === 'attachments' || columnKey === 'notes') {
        const current = columnFilters[columnKey] || [];
        if (apiattachementsLabels && apiattachementsLabels.length > 0) {
            console.log(apiattachementsLabels)
            apiattachementsLabels.forEach(status => {
                const isChecked = current.includes(status.value);
                html += '<div class="column-filter-option" data-value="' + status.value +
                    '"><input type="radio" name="col_filter_' + columnKey + '" id="col_' + columnKey + '_' +
                    status.value + '" ' + (isChecked ? 'checked' : '') + '><label for="col_' + columnKey +
                    '_' + status.value + '"><span>' + status.label + '</span></label></div>';
            });
        }

    } else if (columnKey === 'paymentStatus') {
        const current = columnFilters[columnKey] || [];
        // Generate options from API data
        if (apiPaymentStatuses && apiPaymentStatuses.length > 0) {
            apiPaymentStatuses.forEach(status => {
                const isChecked = current.includes(status.value);
                html += '<div class="column-filter-option" data-value="' + status.value +
                    '"><input type="radio" name="col_filter_' + columnKey + '" id="col_' + columnKey + '_' +
                    status.value + '" ' + (isChecked ? 'checked' : '') + '><label for="col_' + columnKey +
                    '_' + status.value + '"><span>' + status.label + '</span></label></div>';
            });
        }
    } else if (columnKey === 'postingStatus') {
        const current = columnFilters[columnKey] || [];
        // Generate options from API data (carryForwardStatus)
        if (apiCarryForwardStatuses && apiCarryForwardStatuses.length > 0) {
            apiCarryForwardStatuses.forEach(status => {
                const isChecked = current.includes(status.value);
                html += '<div class="column-filter-option" data-value="' + status.value +
                    '"><input type="radio" name="col_filter_' + columnKey + '" id="col_' + columnKey + '_' +
                    status.value + '" ' + (isChecked ? 'checked' : '') + '><label for="col_' + columnKey +
                    '_' + status.value + '"><span>' + status.label + '</span></label></div>';

            });
        }
    } else if (columnKey === "taxCategory") {
        const current = columnFilters[columnKey] || [];
        // Generate options from API data (taxCategories)
        if (apiTaxCategories && apiTaxCategories.length > 0) {
            apiTaxCategories.forEach(status => {
                const isChecked = current.includes(status.value);
                html += '<div class="column-filter-option" data-value="' + status.value +
                    '"><input type="radio" name="col_filter_' + columnKey + '" id="col_' + columnKey + '_' +
                    status.value + '" ' + (isChecked ? 'checked' : '') + '><label for="col_' + columnKey +
                    '_' + status.value + '"><span>' + status.label + '</span></label></div>';
            });
        }
    } else if (columnKey === 'zatcaStatus') {
        const current = columnFilters[columnKey] || [];
        // Generate options from API data (sentStatuses)
        if (apiSentStatuses && apiSentStatuses.length > 0) {
            apiSentStatuses.forEach(status => {
                const isChecked = current.includes(status.value);
                html += '<div class="column-filter-option" data-value="' + status.value +
                    '"><input type="radio" name="col_filter_' + columnKey + '" id="col_' + columnKey + '_' +
                    status.value + '" ' + (isChecked ? 'checked' : '') + '><label for="col_' + columnKey +
                    '_' + status.value + '"><span>' + status.label + '</span></label></div>';
            });
        }
    } else if (columnKey === 'vatReturn') {
        const current = columnFilters[columnKey] || [];
        // Generate options from API data (listedStatus)
        if (apiListedStatuses && apiListedStatuses.length > 0) {
            apiListedStatuses.forEach(status => {
                const isChecked = current.includes(status.value);
                html += '<div class="column-filter-option" data-value="' + status.value +
                    '"><input type="radio" name="col_filter_' + columnKey + '" id="col_' + columnKey + '_' +
                    status.value + '" ' + (isChecked ? 'checked' : '') + '><label for="col_' + columnKey +
                    '_' + status.value + '"><span>' + status.label + '</span></label></div>';

            });
        }
    } else {
        const currentFilter = columnFilters[columnKey] ? columnFilters[columnKey][0] : '';
        html += '<input type="text" class="column-filter-search" id="search_' + columnKey +
            '" placeholder="ابحث..." value="' + String(currentFilter).replace(/"/g, '&quot;') +
            '" style="margin-bottom: 0;">';
    }

    html += '</div>';
    html +=
        '<div class="column-filter-footer"><button class="column-filter-btn-action column-filter-btn-apply" onclick="applyColumnFilter(\'' +
        columnKey +
        '\')" type="button">✓ تطبيق</button><button class="column-filter-btn-action column-filter-btn-clear" onclick="clearColumnFilter(\'' +
        columnKey + '\')" type="button">✕ مسح</button></div>';

    dropdown.innerHTML = html;

    // Improve:
    return dropdown;
}

function applyColumnFilter(columnKey) {
    console.log(columnKey);
    const dropdown = document.querySelector('.column-filter-dropdown[data-column="' + columnKey + '"]');
    if (!dropdown) return;

    if (columnKey === 'attachments' || columnKey === 'notes' || columnKey === 'paymentStatus' || columnKey ===
        'postingStatus' || columnKey === 'zatcaStatus' || columnKey === 'vatReturn' ||
        columnKey === "taxCategory"
    ) {

        const radios = dropdown.querySelectorAll('.column-filter-option input[type="radio"]:checked');
        const selectedValues = Array.from(radios).map(rb => rb.closest('.column-filter-option').dataset.value);
        if (columnKey == "attachments") {
            fetchVatDeclarationDetails(null, null, null, null, null, "attachment", selectedValues[0] || null);
        }
        if (columnKey == "notes") {
            fetchVatDeclarationDetails(null, null, null, null, null, "note", selectedValues[0] || null);
        }
        if (columnKey == "taxCategory") {
            fetchVatDeclarationDetails(null, null, null, null, null, "tax_category", selectedValues[0] || null);
        }



        const allOptions = {
            attachments: ['exist', 'no_exist'],
            notes: ['has', 'no'],
            taxCategory: apiTaxCategories.map(s => s.value),
            paymentStatus: apiPaymentStatuses.map(s => s.value),
            postingStatus: apiCarryForwardStatuses.map(s => s.value),
            zatcaStatus: apiSentStatuses.map(s => s.value),
            vatReturn: apiListedStatuses.map(s => s.value)
        }[columnKey] || [];

        // same behavior as paymentStatus: no selection OR all selections => no filter
        if (selectedValues.length === 0) {
            delete columnFilters[columnKey];
            // Clear filter from API
            if (columnKey === 'paymentStatus' || columnKey === 'postingStatus' || columnKey === 'zatcaStatus' ||
                columnKey === 'vatReturn') {
                fetchVatDeclarationDetails(null, null, null, null, null, null, null);
            }
        } else {
            columnFilters[columnKey] = selectedValues;
            // Send filter to API with correct parameter name
            if (columnKey === 'paymentStatus') {

                fetchVatDeclarationDetails(null, null, null, null, null, 'payment_status', selectedValues[0]);
            } else if (columnKey === 'postingStatus') {
                fetchVatDeclarationDetails(null, null, null, null, null, 'carry_forward_status', selectedValues[0]);
            } else if (columnKey === 'zatcaStatus') {
                fetchVatDeclarationDetails(null, null, null, null, null, 'sent_status', selectedValues[0]);
            } else if (columnKey == "vatReturn") {
                fetchVatDeclarationDetails(null, null, null, null, null, "listed_status", selectedValues[0]);
            }
        }
    } else {
        const searchInput = dropdown.querySelector('#search_' + columnKey);
        if (searchInput && searchInput.value.trim()) {
            const key =
                columnKey == "docNo" ? "document_number" :
                    columnKey == "docType" ? "document_type" :
                        columnKey == "reference" ? "reference" :
                            columnKey == "taxCode" ? "tax_code" :
                                columnKey == "taxType" ? "tax_type" :
                                    columnKey == "type" ? "type" :
                                        columnKey == "project" ? "project" :
                                            columnKey == "createdBy" ? "created_by" :
                                                columnKey == "accountName" ? "account_name" :
                                                    "";

            console.log(key);

            fetchVatDeclarationDetails(null, null, null, null, null, key, searchInput.value.trim());
        } else {
            fetchVatDeclarationDetails(null, null, null, null, null, null, null);
        }
    }

    const btn = document.querySelector('.column-filter-btn[onclick*="\'' + columnKey + '\'"]');
    if (btn) {
        if (columnFilters[columnKey]) btn.classList.add('active');
        else btn.classList.remove('active');
    }

    closeColumnFilter(columnKey);
    applyFilters({
        resetPage: true
    });
    updateColumnHeaderFilters();
    updateSearchFilterButtonState();

    saveState();
}

function clearColumnFilter(columnKey) {
    delete columnFilters[columnKey];

    const btn = document.querySelector('.column-filter-btn[onclick*="\'' + columnKey + '\'"]');
    if (btn) btn.classList.remove('active');

    closeColumnFilter(columnKey);
    applyFilters({
        resetPage: true
    });
    fetchVatDeclarationDetails(null, null, null, null, null, null, null);
    updateSearchFilterButtonState();
    updateColumnHeaderFilters();
    saveState();
}

function closeColumnFilter(columnKey) {
    const dropdown = document.querySelector('.column-filter-dropdown[data-column="' + columnKey + '"]');
    if (dropdown) dropdown.remove();
    activeColumnFilter = null;
}

// ==================== TABLE COLUMN RESIZING ====================
let isResizing = false;
let currentColumn = null;
let startX = 0;
let startWidth = 0;

function initColumnResizing() {
    const resizeHandles = document.querySelectorAll('.resize-handle');

    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', function (e) {
            e.stopPropagation();
            isResizing = true;
            currentColumn = this.parentElement;
            startX = e.pageX;
            startWidth = currentColumn.offsetWidth;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing || !currentColumn) return;

        const diff = e.pageX - startX;
        const newWidth = startWidth + diff;

        if (newWidth >= 50) {
            currentColumn.style.width = newWidth + 'px';
            currentColumn.style.minWidth = newWidth + 'px';
        }
    });

    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            currentColumn = null;
            document.body.style.cursor = 'default';
        }
    });
}

// ==================== ROW ACTIONS ====================
function deleteRow(id, docNo, event) {
    if (event) event.stopPropagation();

    if (!confirm(`هل تريد حذف المستند ${docNo}؟`)) return;

    const url = "https://foo.thevalue.sa/en/admin/settings/vat-declaration-details/delete-selected";

    fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': '{{ csrf_token() }}',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            ids: [id] // 👈 نحذف عنصر واحد فقط
        })
    })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'فشل حذف المستند');
            }
            return data;
        })
        .then(data => {

            // 🔹 Update frontend data
            normalizedVatData = normalizedVatData.filter(r => r.id !== id);

            if (notesData && notesData[docNo]) {
                delete notesData[docNo];
                saveNotesData();
            }

            clearSelection();
            applyFilters({
                resetPage: true
            });

            alert(`تم حذف المستند ${docNo} بنجاح ✓`);
        })
        .catch(err => {
            alert(err.message);
        });
}

// ==================== VIEW TOGGLE (SUMMARY / DETAILED) ====================
function setItemsLinesView(view, opts = {}) {
    const next = (view === 'summary') ? 'summary' : 'detailed';
    const prev = itemsLinesView;
    itemsLinesView = next;
    visibleColumns.expand = itemsLinesView === 'detailed';

    const expandAllOnEnter = !!opts.expandAllOnEnter;
    if (next === 'detailed' && prev !== 'detailed' && expandAllOnEnter) {
        // Explicit: open all invoices' items when entering detailed mode
        collapsedItemDocNos = new Set();
    } else if (next === 'detailed' && prev !== 'detailed' && (!collapsedItemDocNos || collapsedItemDocNos.size ===
        0)) {
        console.log("here");
        const src = (Array.isArray(filteredData) && filteredData.length) ? filteredData : normalizedVatData;
        collapsedItemDocNos = new Set();
    }
    saveState();
    updateItemsLinesViewUI();
    applyFilters({
        resetPage: false
    });
}

function updateItemsLinesViewUI() {
    const summaryBtn = document.getElementById('tableViewSummaryBtn');
    const detailedBtn = document.getElementById('tableViewDetailedBtn');
    const expandHeader = document.getElementById('expandColumnHeader');

    if (summaryBtn) summaryBtn.classList.toggle('active', itemsLinesView === 'summary');
    if (detailedBtn) detailedBtn.classList.toggle('active', itemsLinesView === 'detailed');
    if (summaryBtn) summaryBtn.setAttribute('aria-pressed', itemsLinesView === 'summary' ? 'true' : 'false');
    if (detailedBtn) detailedBtn.setAttribute('aria-pressed', itemsLinesView === 'detailed' ? 'true' : 'false');

    // Update expand column header with icon based on mode
    if (expandHeader) {
        if (itemsLinesView === 'detailed') {
            expandHeader.innerHTML = '☰';
            expandHeader.classList.add('expand-all-enabled');
            expandHeader.setAttribute('aria-disabled', 'false');
            expandHeader.setAttribute('title', 'فتح/طي جميع سطور المنتجات');
        } else {
            expandHeader.innerHTML = '━';
            expandHeader.classList.remove('expand-all-enabled');
            expandHeader.setAttribute('aria-disabled', 'true');
            expandHeader.setAttribute('title', 'لتفعيل فتح/طي الكل اختر العرض: تفصيلي');
        }
        expandHeader.style.color = 'var(--vp-accent)';
        expandHeader.style.fontSize = '16px';
        expandHeader.style.fontWeight = '900';
    }
}

function toggleInvoiceItems(docNo) {
    const key = String(docNo);
    if (collapsedItemDocNos.has(key)) collapsedItemDocNos.delete(key);
    else collapsedItemDocNos.add(key);
    saveState();
    renderTable();
}


function getVisibleDocNosWithItemsForToggleAll() {
    // For a header "toggle all", it's most intuitive to affect the currently visible invoices:
    // - When not grouped: the current page slice.
    // - When grouped: all filtered rows (grouping already expands/collapses by group).
    const src = (Array.isArray(filteredData) && filteredData.length) ? filteredData : normalizedVatData;
    const rows = (!activeGrouping || activeGrouping === 'docType') ?
        src.slice((currentPage - 1) * perPage, (currentPage - 1) * perPage + perPage) :
        src;

    return Array.from(new Set(
        rows.filter(r => r.items && r.items.length > 0).map(r => String(r.docNo))
    ));
}

function toggleExpandAllFromHeader() {
    // Requirement:
    // - Click: expand all item lines (keep all expanded).
    // - Click again: collapse all item lines back to a single invoice row.
    // - Icon shape must NOT change (because user is in detailed mode).
    // IMPORTANT: Do not change the user's selected view mode.
    // In summary mode, the header icon is not active.
    if (itemsLinesView !== 'detailed') return;

    const docNosWithItems = getVisibleDocNosWithItemsForToggleAll();
    if (docNosWithItems.length === 0) return;

    const allExpanded = docNosWithItems.every(docNo => !collapsedItemDocNos.has(docNo));
    if (allExpanded) {
        // Collapse all visible invoices (stay in detailed mode)
        docNosWithItems.forEach(docNo => collapsedItemDocNos.add(docNo));
    } else {
        // Expand all visible invoices (stay in detailed mode)
        docNosWithItems.forEach(docNo => collapsedItemDocNos.delete(docNo));
    }

    saveState();
    renderTable();
    updateItemsLinesViewUI();
}

// ==================== UTILS ====================
function fmt(num) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(num || 0));
}

function formatNumber(num) {
    return Number(num || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function fmtQty(num) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    }).format(Number(num || 0));
}

function getLineItemTypeLabel(lineItem, parentDocType = '') {
    const raw = String(lineItem?.type ?? lineItem?.itemType ?? lineItem?.kind ?? '').toLowerCase().trim();
    const name = String(lineItem?.name ?? '').toLowerCase();
    const doc = String(parentDocType ?? '').toLowerCase();

    const isService =
        lineItem?.isService === true ||
        lineItem?.service === true ||
        raw === 'service' ||
        raw === 'services' ||
        raw === 'svc' ||
        raw === 'خدمة' ||
        name.includes('خدمة') ||
        name.includes('service') ||
        doc.includes('خدمة') ||
        doc.includes('service');

    return isService ? 'خدمة' : 'منتج';
}

function getZatcaStatusBadge(status) {
    if (status === 'sent') {
        return '<span class="zatca-badge zatca-sent" title="تم الإرسال للهيئة بنجاح">✓ مُرسل</span>';
    }
    return '<span class="zatca-badge zatca-not-sent" title="لم يتم الإرسال">○ لم يُرسل</span>';
}

function getVatReturnPeriodLabel(dateStr) {
    const fallback = 'الربع الأول-2025';
    const s = String(dateStr || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return fallback;
    const year = m[1];
    const month = Number(m[2]);
    if (!month || month < 1 || month > 12) return fallback;
    const q = Math.floor((month - 1) / 3) + 1;
    const ord = q === 1 ? 'الأول' : q === 2 ? 'الثاني' : q === 3 ? 'الثالث' : 'الرابع';
    return `الربع ${ord}-${year}`;
}

function getVatReturnBadge(status, dateStr) {
    if (status === 'submitted') {
        const period = getVatReturnPeriodLabel(dateStr);
        return `<span class="vat-return-badge vat-return-submitted">✓ مُدرج في إقرار ${escapeHtml(period)}</span>`;
    }
    return '<span class="vat-return-badge vat-return-not-submitted">○ لم يُدرج</span>';
}

function getPostingStatusLabel(status) {
    const labels = {
        posted: 'مرحّل',
        draft: 'مسودة',
        cancelled: 'ملغي'
    };
    return labels[status] || (status || '–');
}

function getPostingStatusBadge(status) {
    const badges = {
        posted: '<span class="payment-status paid">مرحّل</span>',
        draft: '<span class="payment-status unpaid">مسودة</span>',
        cancelled: '<span class="payment-status returned">ملغي</span>'
    };
    return badges[status] || '<span class="payment-status">—</span>';
}

// ==================== GLOBAL CLICK / KEY HANDLERS ====================
function closeFiltersGroupIfOutside(e) {
    const filtersBtn = document.getElementById('filtersBtn');
    const groupBtn = document.getElementById('groupBtn');
    const filtersMenu = document.getElementById('filtersMenu');
    const groupMenu = document.getElementById('groupMenu');

    if (filtersMenu && filtersBtn && !filtersBtn.contains(e.target) && !filtersMenu.contains(e.target)) {
        filtersMenu.style.display = 'none';
        filtersBtn.classList.remove('active');
    }

    if (groupMenu && groupBtn && !groupBtn.contains(e.target) && !groupMenu.contains(e.target)) {
        groupMenu.style.display = 'none';
        groupBtn.classList.remove('active');
    }
}

function closeSmartSearchIfOutside(e) {
    const container = document.querySelector('.smart-search-container');
    const dropdown = document.getElementById('smartSearchDropdown');
    if (container && dropdown && !container.contains(e.target)) {
        dropdown.classList.remove('active');
    }
}

function closeColumnFilterIfOutside(e) {
    if (!e.target.closest('.column-filter-btn') && !e.target.closest('.column-filter-dropdown')) {
        document.querySelectorAll('.column-filter-dropdown').forEach(d => d.remove());
        activeColumnFilter = null;
    }
}

function closeMainMenuIfOutside(e) {
    if (!e.target.closest('.dropdown')) {
        closeMenu();
    }
}

function closeCustomDateInputsIfOutside(e) {
    const customInputs = document.getElementById('customDateInputs');
    const dateSelect = document.getElementById('datePresetSelect');

    if (customInputs && dateSelect && customInputs.style.display === 'flex') {
        if (!customInputs.contains(e.target) && !dateSelect.contains(e.target)) {
            customInputs.style.display = 'none';
        }
    }
}

document.addEventListener('click', function (e) {
    closeFiltersGroupIfOutside(e);
    closeSmartSearchIfOutside(e);
    closeColumnFilterIfOutside(e);
    closeMainMenuIfOutside(e);
    closeCustomDateInputsIfOutside(e);
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        // Close overlays and dropdowns
        closeDetailsPanel();
        closeColumnModal();
        closeMenu();
        document.getElementById('smartSearchDropdown')?.classList.remove('active');
        document.querySelectorAll('.column-filter-dropdown').forEach(d => d.remove());

        const filtersMenu = document.getElementById('filtersMenu');
        const groupMenu = document.getElementById('groupMenu');
        if (filtersMenu) filtersMenu.style.display = 'none';
        if (groupMenu) groupMenu.style.display = 'none';

        document.getElementById('filtersBtn')?.classList.remove('active');
        document.getElementById('groupBtn')?.classList.remove('active');

        const customInputs = document.getElementById('customDateInputs');
        if (customInputs && customInputs.style.display === 'flex') customInputs.style.display = 'none';
    }
});

// Quick focus shortcut for accounting workflows: Ctrl+K or /
document.addEventListener('keydown', function (e) {
    const isTypingTarget = ['INPUT', 'TEXTAREA'].includes((e.target && e.target.tagName) ? e.target
        .tagName : '');
    if (isTypingTarget) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
        showSmartSearch();
    }

    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
        showSmartSearch();
    }
});

// Smart-search keyboard navigation (accounting-friendly)
document.getElementById('searchInput')?.addEventListener('keydown', function (e) {
    const dropdown = document.getElementById('smartSearchDropdown');
    const isOpen = !!dropdown?.classList.contains('active');

    if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        moveSmartKbd(+1);
        return;
    }

    if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        moveSmartKbd(-1);
        return;
    }

    if (e.key === 'Enter') {
        if (isOpen) {
            e.preventDefault();
            const picked = applySmartKbdSelection();
            if (!picked) commitSearch();
            return;
        }
        // No dropdown: commit search
        commitSearch();
        return;
    }

    if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        dropdown.classList.remove('active');
    }
});

// ==================== INIT ====================
function hydrateUIFromState() {
    // VAT pills
    const pills = Array.from(document.querySelectorAll('.mode-pill'));
    pills.forEach(p => {
        const mode = p.dataset.mode || 'summary';
        const isActive = mode === currentVATMode;
        p.classList.toggle('active', isActive);
        p.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Per page
    const perPageEl = document.getElementById('perPageSelect');
    if (perPageEl) perPageEl.value = String(perPage);

    // Search scope select + placeholder
    const scopeSelect = document.getElementById('searchScopeSelect');
    // const allowedScopes = new Set(['all', 'docNo', 'party', 'branch', 'reference', 'docType', 'taxCode', 'amounts']);
    // if (!allowedScopes.has(activeSearchScope)) activeSearchScope = 'all';
    if (scopeSelect) scopeSelect.value = activeSearchScope || 'all';
    updateSearchPlaceholder();

    // Filters selects + checkboxes
    const docTypeSelect = document.getElementById('docTypeSelect');
    const taxCategorySelect = document.getElementById('taxCategorySelect');
    const filterDocType = document.getElementById('filterDocType');
    const filterTaxCategory = document.getElementById('filterTaxCategory');

    if (docTypeSelect) docTypeSelect.value = activeDocTypeFilter;
    if (taxCategorySelect) taxCategorySelect.value = activeTaxCategoryFilter;

    if (filterDocType) filterDocType.checked = !!activeDocTypeFilter;
    if (filterTaxCategory) filterTaxCategory.checked = !!activeTaxCategoryFilter;

    const docTypeSection = document.getElementById('docTypeSection');
    const taxCategorySection = document.getElementById('taxCategorySection');
    if (docTypeSection) docTypeSection.style.display = activeDocTypeFilter ? 'block' : 'none';
    if (taxCategorySection) taxCategorySection.style.display = activeTaxCategoryFilter ? 'block' : 'none';

    const groupRadios = document.querySelectorAll('input[name="groupBy"]');
    groupRadios.forEach(r => {
        r.checked = r.value === activeGrouping;
    });

    // Column filter indicators
    Object.keys(columnFilters || {}).forEach((key) => {
        const btn = document.querySelector('.column-filter-btn[onclick*="\'' + key + '\'"]');
        if (btn) btn.classList.add('active');
    });

    updateFilterBadge();
    updateActiveChips();
    applyColumnVisibility();
    updateItemsLinesViewUI();
}

loadState();

// Match search field width to combined width of row 2 elements
function matchSearchWidth() {
    setTimeout(() => {
        const viewToggle = document.querySelector('.view-toggle-group');
        const dateRange = document.querySelector('.control-hub .control-row:nth-child(2) > div:last-child');
        const searchContainer = document.querySelector('.smart-search-container');

        if (viewToggle && dateRange && searchContainer) {
            const viewToggleWidth = viewToggle.offsetWidth;
            const dateRangeWidth = dateRange.offsetWidth;
            const gap = 16; // gap between elements
            const totalWidth = viewToggleWidth + dateRangeWidth + gap;

            searchContainer.style.width = totalWidth + 'px';
            searchContainer.style.minWidth = totalWidth + 'px';
            searchContainer.style.maxWidth = totalWidth + 'px';
        }
    }, 150);
}

// Re-match on window resize
window.addEventListener('resize', matchSearchWidth);

loadFlatpickr()
    .then(() => {
        initRangePicker();
        initCustomDatePickers();
        hydrateUIFromState();
        applyFilters({
            resetPage: false
        });
        initColumnResizing();
        matchSearchWidth();
        fetchVatDeclarationDetails();
    })
    .catch(() => {
        initRangePicker();
        hydrateUIFromState();
        applyFilters({
            resetPage: false
        });
        initColumnResizing();
        matchSearchWidth();
        fetchVatDeclarationDetails();
    });


