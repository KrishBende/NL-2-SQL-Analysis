from flask import Flask, render_template, request, jsonify
import mysql.connector
from collections import defaultdict
import requests
import json
import os
from dotenv import load_dotenv
import re
import time

# Load environment variables
load_dotenv()

def mysql_connect(host="127.0.0.1", user="root", password="1234567890", database="classicmodels"):
    mydb = mysql.connector.connect(
        host=host,
        user=user,
        password=password,
        database=database
    )
    return mydb

def get_db_context(database):
    mycursor = database.cursor()
    mycursor.execute("""SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
        FROM
        INFORMATION_SCHEMA.COLUMNS
        WHERE
        TABLE_SCHEMA = 'classicmodels'
        ORDER BY
        TABLE_SCHEMA,
        TABLE_NAME,
        ORDINAL_POSITION;
                    """)

    myresult = mycursor.fetchall()
    mycursor.close()
    db_list = [[row[1], row[2], row[3], row[4], row[5]] for row in myresult]
    
    result = defaultdict(list)

    for item in db_list:
        key = item[0]
        value = item[1:]
        result[key].append(value)

    db_context_dict = dict(result)

    return db_context_dict

def query_generation(openrouter_key, result_dict, nl_query):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "x-ai/grok-4-fast:free",
        "messages": [
                        {"role": "user",
                        "content": f"""You are a SQL generation assistant for MySQL. Generate a safe, read-only MySQL SELECT query that answers the request.
                                        - RETURN ONLY VALID EXECUTABLE SQL, NO BACKTICKS AND NO EXPLANATIONS.
                                        - Use correct column/table names from the schema.
                                        DB schema (showing tables and columns): {result_dict}
                                        User request: {nl_query}
                                    """}
        ],
        "temperature": 0.5
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        response_data = response.json()

        model_reply = response_data["choices"][0]["message"]["content"]

    except requests.exceptions.RequestException as e:
        return(f"An error occurred during the API request: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON response.")
        return(f"Raw response content: {response.text}")
    except Exception as e:
        return(f"An unexpected error occurred: {e}")

    return model_reply

def execute_query(model_reply, database):
    mycursor = database.cursor()
    try:
        mycursor.execute(model_reply)
        myresult = mycursor.fetchall()
        column_names = [desc[0] for desc in mycursor.description]  # Get column names
        
    except Exception as e:
        mycursor.close()
        return f"Invalid query- {e}", []

    finally:
        mycursor.close()

    return myresult, column_names

def explain_output(myresult, nl_query, model_reply, openrouter_key):
    time.sleep(10)
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "x-ai/grok-4-fast:free",
        "messages": [
            {"role": "user",
            "content": f"""
                        You are a concise professional SQL assistant. Answer the user's question from the SQL result ouputted.
                        Explain and provide insights from the result. DO NOT USE ANY MARKDOWN TEXT FORMATTING
                        User Question: {nl_query}
                        Output- {myresult}
                        """}
        ],
        "temperature": 0.5
    }

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        response_data = response.json()

        model_answer = response_data["choices"][0]["message"]["content"]
        return(model_answer)

    except requests.exceptions.RequestException as e:
        return(f"An error occurred during the API request: {e}")
    except json.JSONDecodeError:
        print("Failed to decode JSON response.")
        return(f"Raw response content: {response.text}")
    except Exception as e:
        return(f"An unexpected error occurred: {e}")

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_query', methods=['POST'])
def process_query():
    user_query = request.json.get('query', '')
    
    if not user_query:
        return jsonify({'error': 'Query is required'}), 400
    
    # Get API key from environment
    openrouter_key = os.getenv('openrouter_key')
    if not openrouter_key:
        return jsonify({'error': 'OpenRouter API key not found in environment'}), 500
    
    try:
        # Connect to database
        mydb = mysql_connect()
        
        # Get database context
        db_context_dict = get_db_context(database=mydb)
        
        # Generate SQL query
        model_reply = query_generation(openrouter_key=openrouter_key, result_dict=db_context_dict, nl_query=user_query)
        
        # Execute the query
        query_result, column_names = execute_query(model_reply=model_reply, database=mydb)
        
        # Explain the output
        final_reply = explain_output(myresult=query_result, nl_query=user_query, model_reply=model_reply, openrouter_key=openrouter_key)
        
        # Close database connection
        mydb.close()
        
        return jsonify({
            'user_query': user_query,
            'sql_query': model_reply,
            'query_result': query_result,
            'column_names': column_names,
            'explanation': final_reply
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)