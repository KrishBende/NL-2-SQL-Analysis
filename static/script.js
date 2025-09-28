document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('queryForm');
    const userQueryInput = document.getElementById('userQuery');
    const submitBtn = document.getElementById('submitBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultsContainer = document.getElementById('resultsContainer');
    const errorContainer = document.getElementById('errorContainer');
    
    const userQuestionDiv = document.getElementById('userQuestion');
    const sqlQueryPre = document.getElementById('sqlQuery');
    const queryResultsDiv = document.getElementById('queryResults');
    const explanationDiv = document.getElementById('explanation');
    
    
    
    // Add placeholder animations
    const textarea = document.getElementById('userQuery');
    textarea.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    textarea.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
    
    // Add sample queries for user convenience
    const sampleQueries = [
        "Which orders were shipped later than the required date?",
        "Which product lines have an average buying price higher than the average MSRP of all products? Show the product line and the difference.",
        "Which product line makes the most money, and how many different customers have bought from each product line?",
        "Which customers have made payments but never placed an order? Show their customer number, name, and the payment amounts."
    ];
    
    let queryIndex = 0;
    const interval = setInterval(() => {
        if (userQueryInput.value === '') {
            userQueryInput.placeholder = sampleQueries[queryIndex];
            queryIndex = (queryIndex + 1) % sampleQueries.length;
        }
    }, 5000);
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userQuery = userQueryInput.value.trim();
        if (!userQuery) {
            showError('Please enter a question about the database.');
            return;
        }
        
        // Add visual feedback for submission
        form.style.transform = 'scale(0.98)';
        form.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            form.style.transform = 'scale(1)';
        }, 200);
        
        // Show loading, hide previous results and errors
        showLoading();
        hideResults();
        hideError();
        
        try {
            const response = await fetch('/process_query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: userQuery })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred while processing the query');
            }
            
            // Display results with animation
            displayResults(data);
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'An unexpected error occurred');
        } finally {
            hideLoading();
        }
    });
    
    function showLoading() {
        loadingIndicator.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        // Add pulse animation to the submit button
        submitBtn.style.animation = 'pulse 1.5s infinite';
    }
    
    function hideLoading() {
        loadingIndicator.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate SQL Query';
        submitBtn.style.animation = 'none';
    }
    
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.classList.remove('hidden');
        
        // Add shake animation for error
        errorContainer.style.animation = 'shake 0.5s';
        setTimeout(() => {
            errorContainer.style.animation = 'none';
        }, 500);
    }
    
    function hideError() {
        errorContainer.classList.add('hidden');
        errorContainer.textContent = '';
    }
    
    function hideResults() {
        resultsContainer.classList.add('hidden');
    }
    
    function displayResults(data) {
        // Animate results container appearance
        resultsContainer.style.opacity = '0';
        resultsContainer.style.transform = 'translateY(20px)';
        resultsContainer.classList.remove('hidden');
        
        // Display user question
        userQuestionDiv.textContent = data.user_query;
        userQuestionDiv.style.opacity = '0';
        setTimeout(() => {
            userQuestionDiv.style.transition = 'opacity 0.5s ease';
            userQuestionDiv.style.opacity = '1';
        }, 100);
        
        // Display SQL query
        sqlQueryPre.textContent = data.sql_query;
        sqlQueryPre.style.opacity = '0';
        setTimeout(() => {
            sqlQueryPre.style.transition = 'opacity 0.5s ease';
            sqlQueryPre.style.opacity = '1';
        }, 300);
        
        // Display query results as a table
        if (Array.isArray(data.query_result) && data.query_result.length > 0) {
            const table = document.createElement('table');
            
            // Create header row using actual column names
            const headerRow = document.createElement('tr');
            if (data.column_names && data.column_names.length > 0) {
                data.column_names.forEach(columnName => {
                    const th = document.createElement('th');
                    th.textContent = columnName;
                    headerRow.appendChild(th);
                });
            } else {
                // Fallback to generic column names if no column names are provided
                if (Array.isArray(data.query_result[0])) {
                    for (let i = 0; i < data.query_result[0].length; i++) {
                        const th = document.createElement('th');
                        th.textContent = `Column ${i + 1}`;
                        headerRow.appendChild(th);
                    }
                }
            }
            table.appendChild(headerRow);
            
            // Create data rows
            data.query_result.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                // Add staggered animation to rows
                tr.style.opacity = '0';
                if (Array.isArray(row)) {
                    row.forEach(cell => {
                        const td = document.createElement('td');
                        td.textContent = cell !== null ? cell.toString() : 'NULL';
                        tr.appendChild(td);
                    });
                }
                table.appendChild(tr);
                
                // Animate each row with a delay
                setTimeout(() => {
                    tr.style.transition = 'opacity 0.3s ease';
                    tr.style.opacity = '1';
                }, 400 + (rowIndex * 50));
            });
            
            queryResultsDiv.innerHTML = '';
            queryResultsDiv.appendChild(table);
        } else {
            queryResultsDiv.innerHTML = '<p>No results returned from the query.</p>';
        }
        
        // Display explanation
        explanationDiv.innerHTML = data.explanation;
        explanationDiv.style.opacity = '0';
        setTimeout(() => {
            explanationDiv.style.transition = 'opacity 0.5s ease';
            explanationDiv.style.opacity = '1';
        }, 500);
        
        // Animate the results container
        setTimeout(() => {
            resultsContainer.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            resultsContainer.style.opacity = '1';
            resultsContainer.style.transform = 'translateY(0)';
        }, 10);
    }
    
    // Database connection functionality
    const connectionToggle = document.getElementById('connectionToggle');
    const connectionForm = document.getElementById('connectionForm');
    const saveConnectionBtn = document.getElementById('saveConnection');
    
    // Toggle connection form visibility
    connectionToggle.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent closing when clicking toggle
        connectionForm.classList.toggle('hidden');
    });
    
    // Hide connection form when clicking outside
    document.addEventListener('click', function(e) {
        if (!connectionForm.contains(e.target) && e.target !== connectionToggle) {
            connectionForm.classList.add('hidden');
        }
    });
    
    // Save connection details
    saveConnectionBtn.addEventListener('click', function() {
        const host = document.getElementById('dbHost').value;
        const user = document.getElementById('dbUser').value;
        const password = document.getElementById('dbPassword').value;
        const database = document.getElementById('dbName').value;
        
        // Store connection details in localStorage
        const dbConnection = {
            host: host || 'localhost',
            user: user || 'root',
            password: password || '',
            database: database || ''
        };
        
        localStorage.setItem('dbConnection', JSON.stringify(dbConnection));
        
        // Visual feedback
        saveConnectionBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        setTimeout(() => {
            connectionForm.classList.add('hidden');
            saveConnectionBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        }, 1000);
    });
    
    // Add CSS for animations if not already present
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(120, 139, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(120, 139, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(120, 139, 255, 0); }
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-5px); }
            40%, 80% { transform: translateX(5px); }
        }
        
        .input-section.focused {
            border-color: var(--tech-blue);
            box-shadow: 0 0 0 3px rgba(120, 139, 255, 0.3);
        }
        
        .result-section {
            opacity: 0;
        }
        
        .result-section.visible {
            opacity: 1;
            animation: fadeInUp 0.6s ease forwards;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Add scroll animation for results sections
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.result-section').forEach(section => {
        observer.observe(section);
    });
    
    // Modify the form submission to include connection details
    const originalSubmitHandler = form.onsubmit;
    form.onsubmit = async function(e) {
        e.preventDefault();
        
        const userQuery = userQueryInput.value.trim();
        if (!userQuery) {
            showError('Please enter a question about the database.');
            return;
        }
        
        // Get connection details from localStorage
        const dbConnection = JSON.parse(localStorage.getItem('dbConnection')) || {
            host: 'localhost',
            user: 'root',
            password: '',
            database: ''
        };
        
        // Add visual feedback for submission
        form.style.transform = 'scale(0.98)';
        form.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            form.style.transform = 'scale(1)';
        }, 200);
        
        // Show loading, hide previous results and errors
        showLoading();
        hideResults();
        hideError();
        
        try {
            const response = await fetch('/process_query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query: userQuery,
                    connection: dbConnection
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred while processing the query');
            }
            
            // Display results with animation
            displayResults(data);
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'An unexpected error occurred');
        } finally {
            hideLoading();
        }
    };
});